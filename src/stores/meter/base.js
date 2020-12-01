/*
 * This file is part of KubeSphere Console.
 * Copyright (C) 2019 The KubeSphere Console Authors.
 *
 * KubeSphere Console is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * KubeSphere Console is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with KubeSphere Console.  If not, see <https://www.gnu.org/licenses/>.
 */

import {
  cloneDeep,
  forOwn,
  isArray,
  isEmpty,
  get,
  upperFirst,
  assign,
} from 'lodash'
import { action, observable } from 'mobx'
import { getValueByUnit } from 'utils/monitoring'
import { getTimeRange, getMinuteValue } from 'stores/monitoring/base'
import { getLocalTime } from 'utils'
import ObjectMapper from 'utils/object.mapper'
import {
  RESOURCES_METER_TYPE,
  MERTER_TYPE,
  FEE_CONFIG,
} from 'components/Modals/Bill/constats'
import base from '../base'
import { getTimeStr } from '../../components/Cards/Monitoring/Controller/TimeSelector/utils'

export default class MeterStore extends base {
  module = 'meter'

  @observable
  isLoading = false

  @observable
  data = []

  get apiVersion() {
    if (globals.app.isMultiCluster && this.cluster) {
      return `kapis/clusters/${this.cluster}/metering.kubesphere.io/v1alpha1`
    }
    return 'kapis/metering.kubesphere.io/v1alpha1'
  }

  get tenantUrl() {
    if (globals.app.isMultiCluster && this.cluster) {
      return `kapis/clusrers/${this.cluster}/tenant.kubesphere.io/v1alpha2/meterings`
    }
    return 'kapis/tenant.kubesphere.io/v1alpha2/meterings'
  }

  get mapper() {
    return ObjectMapper[this.module] || (data => data)
  }

  getPaths({
    cluster,
    workspaces,
    namespaces,
    applications,
    services,
    deployments,
    statefulsets,
    pods,
    nodes,
    module,
  }) {
    let path = ''

    if (cluster) {
      path += module === 'cluster' ? '/cluster' : ''
    }

    if (workspaces) {
      path += `/workspaces/${workspaces}`
    }

    if (namespaces) {
      path += `/namespaces/${namespaces}`
    }

    if (applications) {
      path += `/applications`
    }

    if (services) {
      path += `/services`
    }

    if (!pods && (deployments || statefulsets)) {
      path += `/workloads`
    }

    if (nodes && !pods) {
      path += '/nodes'
    }

    if (pods) {
      path += `/pods`
    }

    return path
  }

  getApi = ({ module, ...parpms }) => {
    return `${this.apiVersion}${this.getPaths({ module, ...parpms })}`
  }

  getMeterFilter = type => {
    const _type = RESOURCES_METER_TYPE[type]
    const METER_FILTER = {
      cpu: `meter_${_type}_cpu_usage`,
      memory:
        _type === 'cluster' || _type === 'workspace'
          ? `meter_${_type}_memory_usage`
          : `meter_${_type}_memory_usage_wo_cache`,
      net_transmitted: `meter_${_type}_net_bytes_transmitted`,
      net_received: `meter_${_type}_net_bytes_received`,
    }

    switch (_type) {
      case 'cluster':
      case 'node':
      case 'workspace':
      case 'application':
      case 'namespace':
        METER_FILTER.disk = `meter_${_type}_pvc_bytes_total`
        break
      default:
        break
    }

    return filter => {
      if (filter === 'all') {
        return METER_FILTER
      }
      const meters = {}
      filter.forEach(_item => {
        meters[_item] = METER_FILTER[_item]
      })
      return meters
    }
  }

  getMeterFilterByDic = type => {
    const _type = RESOURCES_METER_TYPE[type]
    return {
      [`meter_${_type}_cpu_usage`]: 'cpu',
      [`meter_${_type}_memory_usage`]: 'memory',
      [`meter_${_type}_memory_usage_wo_cache`]: 'memory',
      [`meter_${_type}_pvc_bytes_total`]: 'disk',
      [`meter_${_type}_net_bytes_transmitted`]: 'net_transmitted',
      [`meter_${_type}_net_bytes_received`]: 'net_received',
    }
  }

  getFormatTime = (ms, showDay) =>
    getLocalTime(Number(ms))
      .format(showDay ? 'YYYY-MM-DD HH:mm' : 'HH:mm:ss')
      .replace(/:00$/g, '')

  handleValueByUnit = (item, module) => {
    const data = cloneDeep(item)
    data.type = this.getMeterFilterByDic(module)[data.type]
    const unitType =
      data.type === 'net_received' || data.type === 'net_transmitted'
        ? 'number'
        : data.type

    const UNIT_CONFIG = {
      cpu: 'core',
      memory: 'Gi',
      number: 'M',
      disk: 'GB',
    }

    const unit = UNIT_CONFIG[unitType]

    Object.keys(data).forEach(key => {
      if (key.indexOf('_') > -1) {
        data[key] = getValueByUnit(data[key], unit)
        data.unit = unit
      }
    })
    return data
  }

  handleSortBySource = list => {
    if (isEmpty(list)) {
      return []
    }

    let data = cloneDeep(list)
    if (data.length < 2) {
      return data
    }

    MERTER_TYPE.forEach((item, index) => {
      const tempIndex = data.findIndex(_item => {
        if (!isEmpty(_item)) {
          return _item.type === item
        }
        return false
      })

      if (index !== tempIndex && tempIndex >= 0) {
        const temp = data[tempIndex]
        data[tempIndex] = data[index]
        data[index] = temp
      }
    })

    data = data.filter(item => !!item)
    return data
  }

  handleLevelParams = ({ module }) => {
    const _module = RESOURCES_METER_TYPE[module]
    const level = `Level${upperFirst(_module)}`

    return { level }
  }

  getExportParams = ({
    cluster,
    workspaces,
    namespaces,
    applications,
    services,
    deployments,
    statefulsets,
    pods,
    nodes,
    isTime,
    start,
    end,
    step,
    module,
    meters,
    resources,
    ...rest
  }) => {
    const params = assign(
      { ...rest },
      this.handleLevelParams({
        module,
      }),
      this.getTimeParams({ isTime, start, end, step }),
      this.getMetricsFilters({ module, meters }),
      this.getResourceFilters({
        module,
        resources,
      }),
      this.handleWorkloadToKind({ deployments, statefulsets }),
      this.handleNodeParams({ nodes, pods })
    )

    if (!rest.operation) {
      delete params.resources_filter
    }
    params.namespace = namespaces
    params.workspace = workspaces
    return params
  }

  getTimeParams = ({ isTime, start, end, step = '1h' }) => {
    const params = {}
    if (isTime) {
      let _step = step
      if (!end || !start) {
        const timeRange = getTimeRange({ step: getMinuteValue(step) })
        params.start = timeRange.start
        params.end = timeRange.end
      }

      if (start) {
        params.start = Math.floor(start / 1000)
      }

      if (end) {
        params.end = Math.floor(end / 1000)
      }

      const day = Math.floor((params.end - params.start) / 3600 / 24)

      if (day >= 30) {
        _step = '1d'
      }
      params.step = getMinuteValue(_step)
    }
    return { ...params }
  }

  getMetricsFilters = ({ meters, module }) => {
    const meterList = []

    if (!isEmpty(meters)) {
      forOwn(this.getMeterFilter(module)(meters), value => {
        meterList.push(value)
      })
    }

    if (!isEmpty(meterList)) {
      return { metrics_filter: meterList.join('|') }
    }
  }

  getResourceFilters = ({ resources, module }) => {
    if (!isEmpty(resources)) {
      const resourcesString = resources.join('|')
      switch (module) {
        case 'applications':
          return { applications: resourcesString }
        case 'services':
          return { services: resourcesString }
        default:
          return { resources_filter: resources.join('|') }
      }
    }
  }

  handleWorkloadToKind = ({ deployments, statefulsets }) => {
    const params = {}
    if (deployments) {
      params.kind = 'deployments'
    }

    if (statefulsets) {
      params.kind = 'statefulsets'
    }
    return params
  }

  handleNodeParams = ({ nodes, pods }) => {
    if (nodes && pods) {
      return { node: nodes, resources_filter: undefined }
    }
  }

  getParams = ({
    start,
    end,
    step = '1h',
    resources = [],
    meters = [],
    module,
    isTime = false,
    deployments,
    statefulsets,
    nodes,
    pods,
    ...rest
  } = {}) => {
    const params = assign(
      rest,
      this.getTimeParams({ start, end, step, isTime }),
      this.getMetricsFilters({ module, meters }),
      this.getResourceFilters({ module, resources }),
      this.handleWorkloadToKind({ deployments, statefulsets }),
      this.handleNodeParams({ nodes, pods })
    )
    return this.setParams(params)
  }

  setParams = params => params

  getResource = ({
    cluster,
    workspaces,
    namespaces,
    applications,
    services,
    deployments,
    statefulsets,
    nodes,
    pods,
  }) => {
    const params = {
      cluster,
      namespaces,
      workspaces,
    }

    if (pods) {
      return { pods, ...params }
    }

    if (nodes) {
      return { nodes, ...params }
    }

    if (deployments || statefulsets) {
      return { deployments, statefulsets, ...params }
    }

    if (services) {
      return { services, ...params }
    }

    if (applications) {
      return { applications, ...params }
    }

    return params
  }

  getOneMeter = (item, params, module) => {
    if (params.start) {
      item.start = params.start * 1000
    }
    if (params.end) {
      item.end = params.end * 1000
    }
    if (params.step) {
      item.step = getTimeStr(params.step)
    }

    item.values = this.fillEmptyMeter(
      { start: params.start, end: params.end, step: params.step.slice(0, -1) },
      item.values
    )

    return this.handleValueByUnit(item, module)
  }

  setOneMeterByType = (item, module) => {
    const { data, metric_name } = item
    const result = get(data, 'result', [])
    let itemObject = {}
    result.forEach(_rusultObject => {
      itemObject = {
        type: metric_name,
        module: RESOURCES_METER_TYPE[module],
        ..._rusultObject,
      }
    })
    return itemObject
  }

  fillEmptyMeter = (params, values) => {
    if (!params.step || !params.start || !params.end) {
      return values
    }

    const format = num => String(num).replace(/\..*$/, '')
    const step = params.step
    const times = Math.floor((params.end - params.start) / step) + 1

    if (values.length < times) {
      const newValues = []
      for (let index = 0; index < times - values.length; index++) {
        const time = format(params.start + index * step)
        newValues.push([time, '0'])
      }

      return [...newValues, ...values]
    }
    return values
  }

  @action
  async fetchMeter({
    cluster,
    workspaces,
    namespaces,
    applications,
    services,
    deployments,
    statefulsets,
    pods,
    nodes,
    ...filter
  } = {}) {
    this.isLoading = true
    let url = ''
    let params = {}
    this.cluster = cluster

    const resource = this.getResource({
      cluster,
      workspaces,
      namespaces,
      applications,
      services,
      deployments,
      statefulsets,
      pods,
      nodes,
    })

    if (filter.operation || filter.module === 'namespaces') {
      url = this.tentUrl

      params = this.getExportParams({
        ...resource,
        ...filter,
      })
    } else {
      params = this.getParams({
        deployments,
        statefulsets,
        pods,
        nodes,
        ...filter,
      })

      url = this.getApi({
        module: filter.module,
        ...resource,
      })
    }

    const result = await request.get(url, params)

    this.isLoading = false

    if (filter.operation) {
      return result
    }

    if (!isEmpty(result) && isArray(result.results)) {
      const { module, meters } = filter

      if (meters === 'all') {
        const _result = result.results.map(item => {
          if (item.data.result) {
            const _item = this.setOneMeterByType(item, module)
            return this.getOneMeter(_item, params, module)
          }
          return false
        })
        const data = this.handleSortBySource(_result)

        this.data = data
        return data
      }

      const _result = result.results[0]
      const data = get(_result, 'data.result', [])
      const metricName = get(_result, 'metric_name', '')
      let meterData = []

      if (!isEmpty(data)) {
        meterData = data.map(meter => {
          meter = {
            type: metricName,
            module: RESOURCES_METER_TYPE[module],
            ...meter,
          }
          return this.handleValueByUnit(meter, module)
        })
      }

      this.data = meterData
      return meterData
    }
    this.data = []
    return []
  }

  @action
  fetchPrice = async () => {
    const url = `${this.tenantUrl}/price_info`

    const result = await request.get(url)

    if (result && !isEmpty(result)) {
      const _result = {}
      Object.keys(result).forEach(key => {
        _result[FEE_CONFIG[key]] = result[key]
      })
      return _result
    }
  }
}
