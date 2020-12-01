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

import React from 'react'
import { observer } from 'mobx-react'
import { action, observable, toJS } from 'mobx'
import { cloneDeep, get, isArray, isEmpty, last, flatten, set } from 'lodash'
import { saveAs } from 'file-saver'
import classnames from 'classnames'

import { SimpleArea } from 'components/Charts'

import { Icon, Loading, Select } from '@pitrix/lego-ui'
import { Button } from 'components/Base'

import MeterStore from 'stores/meter/base'
import ClusterMeterStore from 'stores/meter/cluster'

import { getAreaChartOps, getValueByUnit } from 'utils/monitoring'
import { ICON_TYPES, COLORS_MAP } from 'utils/constants'

import { getLocalTime } from 'utils'
import {
  RESOURCES_TYPE,
  RESOURCE_TITLE,
  METER_RESOURCE_TITLE,
} from '../../constats'
import ConstomChart from '../../components/PieChart'
import TimeSelect from '../../components/TimeSelect'
import SideCard from '../../components/SideCard'
import ResourceList from '../../components/ResourceList'
import MeterDetailCard from '../../components/MeterDetailCard'
import MeterTable from '../../components/Tables'

import styles from '../index.scss'

const AreaColors = [
  'green',
  'blue',
  'yellow',
  'red',
  'darkestGreen',
  'darkestBlue',
  'darkestYellow',
  'darkestRed',
  'lightestGreen',
  'lightestBlue',
  'lightestYellow',
  'lightestRed',
]

@observer
export default class Details extends React.Component {
  store = new MeterStore()

  clusterMeterStore = new ClusterMeterStore()

  @observable
  active = {}

  @observable
  tableData = []

  @observable
  loading = false

  @observable
  sideLoading = false

  @observable
  reportsData = {}

  @observable
  crumbData = []

  @observable
  cacheCrumbData = []

  @observable
  list = []

  @observable
  currentMeterData = {}

  @observable
  parentMeterData = {}

  @observable
  chartData = {}

  @observable
  timeRange = {}

  @observable
  clusters = []

  @observable
  cluster = ''

  @observable
  childrenResourceList = []

  @observable
  customChartData = []

  @observable
  billReportList = []

  initData = async () => {
    this.loading = true
    this.sideLoading = true
    const list = await this.clusterMeterStore.fetchList({
      type: this.props.meterType,
    })

    if (isEmpty(list) || !isArray(list)) {
      this.sideLoading = false
      this.loading = false
    }

    const { name, type, createTime } = list[0]

    this.list = list

    if (type === 'cluster') {
      this.cluster = type
    }

    this.crumbData.push({
      type,
      name,
      list,
      createTime,
    })

    await this.handleSelectResource({
      name,
      type,
      isCopy: true,
      labelSelector: get(this.list, '[0].labelSelector'),
      isTime: true,
      createTime,
      start: createTime,
    })

    this.sideLoading = false
    this.loading = false
  }

  componentDidMount() {
    this.initData()
  }

  handleSelectResource = ({ name, type, ...params }) => {
    if (name === this.active.name && type === this.active.type) {
      return
    }

    if (type === 'workspaces') {
      this.clusters = this.getClustersList(name)
      this.cluster = get(this.clusters, '[0].value', '')
    }

    this.getCurrentMeterData({
      name,
      type,
      isTime: true,
      start: params.createTime,
      ...params,
    })
  }

  @action
  getCurrentMeterData = async ({
    name,
    type,
    isCopy,
    labelSelector,
    createTime,
    isTime,
    start,
  }) => {
    this.active = { name, type, createTime }
    this.tableData = []
    this.customChartData = []
    this.setActiveCrumb({ name, type, isCopy: !!isCopy, createTime })
    const params = this.getMeterParamsByCrumb()

    this.loading = true

    const meterData = await this.setMeterData({
      module: type,
      valueKey: 'currentMeterData',
      meters: 'all',
      resources: [name],
      start: getLocalTime(start).format('X') * 1000,
      isTime,
      params,
    })

    this.tableData = this.initChart(meterData)

    this.setAreaChartData({
      data: meterData,
    })

    if (type !== 'pods') {
      const childrenList = await this.getChildrenList({
        labelSelector,
        currentType: type,
      })
      this.childrenResourceList = childrenList

      if (!isEmpty(toJS(this.tableData))) {
        this.getResourceMeterData(get(this.tableData, '[0].type', 'cpu'))
      }
    } else {
      this.childrenResourceList = []
    }

    this.loading = false
  }

  getChildrenTypeByLevel = _type => {
    const { level } = this.props
    const LevelData = level.find(itemLevel => {
      if (isArray(itemLevel.type)) {
        return itemLevel.type.indexOf(_type) > -1
      }
      return itemLevel.type === _type
    })
    return LevelData
  }

  getTypesListData = async (type, params) => {
    const LevelData = this.getChildrenTypeByLevel(type)
    const requestList = []

    LevelData.children.forEach(_type => {
      requestList.push(
        this.clusterMeterStore.fetchList({
          type: _type,
          ...params,
        })
      )
    })

    const list = await Promise.all(requestList)
    const childrenList = flatten(list)
    return childrenList
  }

  @action
  getChildrenData = async ({ name, type, createTime, labelSelector }) => {
    const lastCrumbData = last(this.crumbData)
    this.billReportList = []
    this.loading = true
    this.sideLoading = true

    if (type === 'workspaces' && name !== lastCrumbData.name) {
      this.clusters = this.getClustersList(name)
      this.cluster = get(this.clusters, '[0].value', '')
    }

    this.setActiveCrumb({ name, type, isCopy: true, createTime })

    const childrenList = await this.getChildrenList({
      labelSelector,
      currentType: type,
    })

    if (!isEmpty(childrenList) && isArray(childrenList)) {
      const childrenType = childrenList[0].type

      const parentType = last(this.crumbData)
      const params = this.getMeterParamsByCrumb()

      await this.setMeterData({
        params,
        meters: 'all',
        module: parentType.type,
        resources: [parentType.name],
        start: getLocalTime(createTime).format('X') * 1000,
        valueKey: 'parentMeterData',
        isTime: true,
      })

      this.crumbData.push({
        type: childrenType,
        name: childrenList[0].name,
        list: childrenList,
        createTime: childrenList[0].createTime,
      })

      await this.getCurrentMeterData({
        name: childrenList[0].name,
        type: childrenType,
        isCopy: true,
        isTime: true,
        start: childrenList[0].createTime,
        createTime: childrenList[0].createTime,
        labelSelector: get(childrenList, '[0].labelSelector'),
      })

      this.list = childrenList
    }

    this.loading = false
    this.sideLoading = false
  }

  @action
  setActiveCrumb = ({ name, type, createTime, isCopy }) => {
    const lastCrumbData = last(this.crumbData)
    lastCrumbData.type = type
    lastCrumbData.name = name
    lastCrumbData.createTime = createTime

    if (isCopy) {
      this.cacheCrumbData = cloneDeep(toJS(this.crumbData))
    }
  }

  @action
  setMeterData = async ({
    params,
    module,
    meters,
    resources,
    valueKey,
    list,
    start,
    end,
    isTime,
  }) => {
    if (params.cluster && this.props.meterType === 'cluster') {
      this.cluster = params.cluster
    }

    params.cluster = this.cluster

    if (module === 'applications' && !isEmpty(resources)) {
      const currentlist = list || this.list
      resources = resources.map(resName => {
        const data = currentlist.find(_itemList => _itemList.name === resName)
        const applicationsVersion =
          get(data, '_origin.version.name', '') ||
          get(data, '_origin.version', '')

        return `${resName}${
          applicationsVersion ? `:${applicationsVersion}` : ''
        }`
      })
    }

    const result = await this.fetchMeterData({
      module,
      meters,
      resources,
      isTime,
      start,
      end,
      ...params,
    })

    const { sumData, feeData } = this.getSumMeterData(result)
    this[valueKey] = {
      sumData,
      feeData,
    }
    return result
  }

  initChart = list => {
    if (isEmpty(list)) {
      return []
    }

    list.map((item, index) => {
      item.key = item.type
      item.color = COLORS_MAP[AreaColors[index]] || AreaColors[index]

      return item
    })
    return list
  }

  @action
  setAreaChartData = async ({ data }) => {
    this.chartData.loading = true

    const price_config = await this.clusterMeterStore.fetchPrice({
      cluster: this.cluster,
    })

    if (isEmpty(data) || isEmpty(price_config)) {
      this.chartData = { loading: false }
      return
    }

    data.forEach(item => {
      item.values = item.values.map(_item => {
        const value = get(_item, [1])
        const valueConvertedByUnit =
          value === '-1' ? null : getValueByUnit(value, item.unit)

        const valueConvertedByPrice =
          valueConvertedByUnit * price_config[item.type]

        set(_item, [1], valueConvertedByPrice)

        return _item
      })

      item.type = METER_RESOURCE_TITLE[item.type]
    })

    const legend = data.map(record => get(record, `type`))

    const _result = {
      title: t('Consumer Trends'),
      unit: t('￥'),
      data,
      legend,
    }

    this.timeRange = {
      start: data[0].start,
      end: data[0].end,
      step: data[0].step,
    }

    this.chartData = getAreaChartOps(_result)
    this.chartData.loading = false
  }

  @action
  handleChartData = async ({ meters, ...params }) => {
    const { name } = this.active
    this.tableData = []

    const data = await this.setMeterData({
      module: this.active.type,
      resources: [name],
      meters,
      isTime: true,
      params,
    })

    this.tableData = this.initChart(data)
    this.setAreaChartData({ data })
    this.chartData.loading = false
  }

  fetchMeterData = async ({ module, meters, resources, ...params }) => {
    const data = await this.clusterMeterStore.fetchMeter({
      module,
      meters,
      resources,
      ...params,
    })
    return data
  }

  getMeterParamsByCrumb = () => {
    const params = {}
    const list = cloneDeep(toJS(this.crumbData))

    if (list[0].type === 'workspaces' && list.length > 2) {
      list.shift()
    }

    list.forEach(item => {
      params[item.type] = item.name
    })

    return params
  }

  getChildrenParamsByCrumb = () => {
    const params = {}
    const list = cloneDeep(toJS(this.crumbData))

    list.forEach(item => {
      params[item.type] = item.name
    })
    return params
  }

  getSumMeterData = result => {
    const sumData = {}
    const feeData = {}
    if (!isEmpty(result)) {
      result.forEach(item => {
        if (item.type) {
          sumData[item.type] = {
            value: get(item, 'sum_value', ''),
            unit: get(item, 'unit', ''),
          }
          feeData[item.type] = {
            value: parseFloat(get(item, 'fee', 0)).toFixed(2),
            unit: t('￥'),
          }
        }
      })
    }
    return { sumData, feeData }
  }

  getChildrenList = async ({ labelSelector, currentType, childParam }) => {
    const LevelData = this.getChildrenTypeByLevel(currentType)
    const resourceParams = {
      ...this.getChildrenParamsByCrumb(),
      ...childParam,
    }

    if (!resourceParams.cluster) {
      resourceParams.cluster = this.cluster
    }

    labelSelector ? (resourceParams.labelSelector = toJS(labelSelector)) : null

    let childrenList = []

    if (currentType === 'namespaces' || currentType === 'services') {
      childrenList = await this.getTypesListData(currentType, resourceParams)
      return childrenList
    }

    if (LevelData.children) {
      childrenList = await this.clusterMeterStore.fetchList({
        type: LevelData.children[0],
        ...resourceParams,
      })
      return childrenList
    }
    return childrenList
  }

  @action
  setCluster = async value => {
    this.cluster = value
    this.loading = true

    const { name, type, createTime } = this.active
    const currentData = this.list.find(item => item.name === name)

    await this.getCurrentMeterData({
      name,
      type,
      isCopy: true,
      start: getLocalTime(createTime).format('X') * 1000,
      isTime: true,
      createTime,
      labelSelector: get(currentData, 'labelSelector', ''),
    })

    this.loading = false
  }

  @action
  getClustersList = name => {
    const workspaceData = this.crumbData[0]
    const currentData = workspaceData.list.find(item => item.name === name)
    const clustersList = get(currentData, '_origin.clusters', [])

    if (isEmpty(clustersList)) {
      return []
    }

    return clustersList.map(item => {
      return {
        label: item.name,
        value: item.name,
      }
    })
  }

  getResourceMeterData = async meters => {
    const params = this.getMeterParamsByCrumb()
    params.workspaces = undefined

    const dataList = []

    const nameList = this.childrenResourceList.map(item => {
      return {
        name: item.name,
        type: item.type,
        labelSelector: get(item, '[0].labelSelector'),
      }
    })

    RESOURCES_TYPE.forEach(itemType => {
      const list = []
      nameList.forEach(item => {
        if (item.type === itemType) {
          list.push(item)
        }
      })
      if (!isEmpty(list)) {
        dataList.push(list)
      }
    })

    dataList.forEach(async lists => {
      const customChartData = []

      const type = lists[0].type
      if (type === 'pods') {
        const podList = lists.map(item => item.name)
        const _params = cloneDeep(params)
        _params[type] = lists[0].name

        const meterData = await this.setMeterData({
          module: type,
          meters: [meters],
          resources: podList,
          params: _params,
        })

        if (!isEmpty(meterData)) {
          this.customChartData = meterData.map(item => {
            return {
              name: get(item, `metric.${item.module}`),
              size: get(item, 'sum_value'),
            }
          })
        }
      } else {
        lists.forEach(async _item => {
          const parentName = { name: _item.name, type: _item.type }
          const requestList = []

          requestList.push(
            this.getChildrenList({
              labelSelector: _item.labelSelector,
              currentType: _item.type,
              childParam: { [_item.type]: _item.name },
            })
          )

          const grandesonListData = await Promise.all(requestList)
          const _grandesonListData = flatten(grandesonListData)

          const requestMeterLists = []

          if (!isEmpty(_grandesonListData)) {
            const _datalist = []

            RESOURCES_TYPE.forEach(itemType => {
              const list = []
              _grandesonListData.forEach(item => {
                if (item.type === itemType) {
                  list.push(item)
                }
              })
              if (!isEmpty(list)) {
                _datalist.push(list)
              }
            })

            _datalist.forEach(_list => {
              const _nameList = _list.map(item => item.name)
              const _params = cloneDeep(params)
              const _type = _list[0].type
              _params[_item.type] = _item.name
              _params[_list[0].type] = _list[0].name

              requestMeterLists.push(
                this.setMeterData({
                  module: _type,
                  meters: [meters],
                  resources: _nameList,
                  params: _params,
                  list: this.childrenResourceList,
                })
              )
            })

            const grandesonMeterDataList = await Promise.all(requestMeterLists)
            const _grandesonMeterDataList = flatten(grandesonMeterDataList)

            parentName.children = []

            _grandesonMeterDataList &&
              _grandesonMeterDataList.forEach(meterData => {
                parentName.children.push({
                  name: get(meterData, `metric.${meterData.module}`),
                  size: get(meterData, 'sum_value'),
                })
              })

            customChartData.push(parentName)
          }
          this.customChartData = customChartData
        })
      }
    })
  }

  handlePieChartData = (namesList, dataList) => {
    if (isEmpty(dataList)) {
      return []
    }

    namesList.forEach(nameData => {
      let name = nameData.name
      const type = nameData.type

      if (type === 'applications') {
        const data = this.childrenResourceList.find(
          _itemList => _itemList.name === name
        )

        const applicationsVersion =
          get(data, '_origin.version.name', '') ||
          get(data, '_origin.version', '')

        name = `${name}${applicationsVersion ? `:${applicationsVersion}` : ''}`
      }

      dataList.forEach(data => {
        const metric = data.metric
        if (!isEmpty(metric)) {
          Object.keys(metric).forEach(key => {
            if (name === metric[key]) {
              data.name = name
            }
          })
        }
      })
    })
    const pieData = dataList.map(data => ({
      name: data.name,
      size: data.sum_value,
      unit: data.unit,
      dataKey: 'size',
    }))

    return pieData
  }

  @action
  handleCrumbOperation = async methord => {
    let step = this.crumbData.length - 1
    this.sideLoading = true

    if (methord === 'back') {
      if (step === 0) {
        this.props.handleBack()
        this.sideLoading = false
        return
      }
      this.crumbData.pop()
      step -= 1
    } else {
      const cacheStep = this.cacheCrumbData.length - 1
      if (cacheStep === 0 || cacheStep === step) {
        this.sideLoading = false
        return
      }
      const featureCrumb = this.cacheCrumbData[step + 1]
      this.crumbData.push(featureCrumb)
      step += 1
    }

    const currentActive = last(this.crumbData)

    if (step > 0) {
      const parentData = this.crumbData[step - 1]
      const params = this.getMeterParamsByCrumb()

      if (parentData.type === 'workspaces') {
        params.workspaces = parentData.name
        this.clusters = this.getClustersList(parentData.name)

        Object.keys(params).forEach(key => {
          if (key !== 'workspaces') {
            params[key] = undefined
          }
        })
      } else {
        params[currentActive.type] = undefined
      }

      this.setMeterData({
        params,
        meters: 'all',
        module: parentData.type,
        start: getLocalTime(parentData.createTime).format('X') * 1000,
        resources: [parentData.name],
        valueKey: 'parentMeterData',
        isTime: true,
      })
    }

    const currentItem = currentActive.list.find(
      item => item.name === currentActive.name
    )

    await this.getCurrentMeterData({
      name: currentActive.name,
      type: currentActive.type,
      start: get(currentItem, 'createTime'),
      createTime: get(currentItem, 'createTime'),
      labelSelector: get(currentItem, 'labelSelector', ''),
      isTime: true,
    })

    this.list = currentActive.list
    this.sideLoading = false
  }

  handleExportBillReport = async () => {
    if (isEmpty(toJS(this.billReportList))) {
      return
    }

    const params = this.getMeterParamsByCrumb()
    const module = last(this.crumbData).type
    params.cluster = this.cluster

    const result = await this.fetchMeterData({
      module,
      meters: 'all',
      resources: this.billReportList,
      isTime: true,
      operation: 'export',
      ...params,
    })

    const name = this.billReportList.join('_')

    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' })
    saveAs(blob, `${name}.txt`)
  }

  renderSide = () => {
    return (
      <div className={styles.side}>
        <div className={styles.sideList}>
          <Loading spinning={this.sideLoading} style={{ width: '100%' }}>
            <>
              {this.list.map(item => (
                <SideCard
                  key={`${item.name}-${item.type}`}
                  data={item}
                  activeName={this.active.name}
                  getCurrentMeterData={this.handleSelectResource}
                  getChildrenData={this.getChildrenData}
                  getCheckData={this.getCheckData}
                  loading={this.sideLoading || this.loading}
                  isCheck={this.billReportList.indexOf(item.name) > -1}
                />
              ))}
            </>
          </Loading>
        </div>
      </div>
    )
  }

  renderCrumbContainer = () => {
    const dom = []
    const length = this.crumbData.length
    this.crumbData.forEach((item, index) => {
      dom.push(
        <span key={`${item.name}-${item.type}`}>
          <Icon name={ICON_TYPES[item.type]} />
          <span className={styles.crumbTitle}>{item.name}</span>
          {index !== length - 1 ? <Icon name="caret-right" /> : null}
        </span>
      )
    })
    return dom
  }

  renderCrumb = () => {
    return (
      <div className={styles.crumbContainer}>
        <Button
          icon="chevron-left"
          iconType="light"
          disabled={this.loading || this.sideLoading}
          onClick={() => this.handleCrumbOperation('back')}
        />
        <Button
          icon="chevron-right"
          iconType="light"
          disabled={this.loading || this.sideLoading}
          onClick={() => this.handleCrumbOperation('front')}
        />
        <span className={styles.crumb}>{this.renderCrumbContainer()}</span>
      </div>
    )
  }

  renderParentMeterCard = () => {
    if (this.active.type === 'cluster' || this.active.type === 'workspaces') {
      return null
    }

    const length = this.crumbData.length
    const data = this.crumbData[length - 2]

    return (
      <div className={styles.usageCard}>
        <MeterDetailCard
          className={styles.meterCard}
          isParent={true}
          title={
            <>
              <span>{t(RESOURCE_TITLE[get(data, 'type', '-')])}</span>
              <strong>{get(data, 'name', '-')}</strong>
            </>
          }
          {...this.parentMeterData}
        />
      </div>
    )
  }

  renderSubResource = () => {
    if (this.active.type === 'pods' || this.props.meterType === 'openpitrix') {
      return null
    }

    return (
      <>
        <div className={styles.subTitle}>{t('Contains Resources')}</div>
        <div className={styles.childrenResourceContainer}>
          <div className={styles.childrenlistContainer}>
            <ResourceList
              selectOptions={toJS(this.currentMeterData.sumData)}
              childrenResourceList={this.childrenResourceList}
              getResourceMeterData={this.getResourceMeterData}
              activeName={this.active.name}
            />
          </div>
          <div className={styles.customContainer}>
            <ConstomChart data={toJS(this.customChartData)} />
          </div>
        </div>
      </>
    )
  }

  renderChart = () => {
    const loading = !!this.chartData.loading

    return (
      <div className={styles.chartContainer}>
        <Loading spinning={loading}>
          <SimpleArea width="100%" height="100%" {...toJS(this.chartData)} />
        </Loading>
      </div>
    )
  }

  renderTitle = () => {
    const { type } = this.active

    return (
      <div className={styles.title}>
        <h2>{t('Consumption Bill')}</h2>
        {type === 'workspaces' && globals.app.isMultiCluster ? (
          <Select
            className={styles.clusterSelect}
            options={toJS(this.clusters)}
            value={this.cluster}
            onChange={this.setCluster}
          />
        ) : null}

        <Button onClick={this.handleExportBillReport}>
          {t('Export Bill')}
        </Button>
      </div>
    )
  }

  getTimeRange = ({ type, value, methord }) => {
    if (methord === 'close') {
      const params = this.getMeterParamsByCrumb()
      set(this.timeRange, `${type}`, value)

      this.handleChartData({
        meters: 'all',
        ...params,
        ...toJS(this.timeRange),
      })
    }

    set(this.timeRange, `${type}`, value)
  }

  @action
  getCheckData = name => {
    const hasResource = this.billReportList.indexOf(name) > -1
    if (hasResource) {
      this.billReportList = this.billReportList.filter(item => item !== name)
    } else {
      this.billReportList.push(name)
    }
  }

  render() {
    const { type, name, createTime } = this.active
    const { start, end, step } = this.timeRange

    return (
      <div className={styles.billDetail}>
        <div
          className={classnames(styles.leftContent, {
            [styles.padding0]: this.crumbData.length < 2,
          })}
        >
          {this.renderCrumb()}
          {this.renderSide()}
          {this.renderParentMeterCard()}
        </div>
        <div className={styles.rightContent}>
          <Loading spinning={this.loading}>
            <div className={styles.content}>
              {this.renderTitle()}
              <MeterDetailCard
                className={styles.toothbg}
                title={
                  <>
                    <span>{t(RESOURCE_TITLE[type])}</span>
                    <strong>{name}</strong>
                  </>
                }
                {...this.currentMeterData}
              />
              <div className={styles.subTitle}>{t('Consumption History')}</div>
              <div className={styles.info}>
                <TimeSelect
                  createTime={createTime}
                  getTime={this.getTimeRange}
                  start={start}
                  end={end}
                  step={step}
                />
              </div>
              {this.renderChart()}
              <MeterTable data={toJS(this.tableData)} />
              {this.renderSubResource()}
            </div>
          </Loading>
        </div>
      </div>
    )
  }
}