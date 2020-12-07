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

import { action, observable } from 'mobx'
import { isArray, isEmpty, get, cloneDeep } from 'lodash'

import ClusterStore from 'stores/cluster'
import NodeStore from 'stores/node'
import WorkspaceStore from 'stores/workspace'
import NamespaceStore from 'stores/project'
import ApplicationCrdStore from 'stores/application/crd'

import ServiceStore from 'stores/service'
import WorkloadStore from 'stores/workload'
import PodStore from 'stores/pod'

import { ICON_TYPES } from 'utils/constants'
import { RESOURCE_TITLE } from 'components/Modals/Bill/constats'

import { getNodeStatus } from 'utils/node'
import { getWorkloadStatus } from 'utils/status'
import Base from './base'

export default class ClusterMeter extends Base {
  @observable
  list = []

  @observable
  cacheList = []

  @observable
  isLoading = false

  clusterStore = new ClusterStore()

  nodeStore = new NodeStore()

  workspaceStore = new WorkspaceStore()

  namespaceStore = new NamespaceStore()

  applicationCrdStore = new ApplicationCrdStore()

  serviceStore = new ServiceStore()

  deploymetStore = new WorkloadStore('deployments')

  statefulsetStore = new WorkloadStore('statefulsets')

  podStore = new PodStore()

  getPath({
    cluster,
    namespaces,
    workspaces,
    deployments,
    statefulsets,
    services,
    pods,
  } = {}) {
    let path = ''

    if (cluster) {
      path += `/klusters/${cluster}`
    }
    if (namespaces) {
      path += `/namespaces/${namespaces}`
    }
    if (workspaces) {
      path += `/workspaces/${workspaces}`
    }
    if (services) {
      path += `/services/${services}`
    }
    if (deployments) {
      path += `/deployments/${deployments}`
    }
    if (statefulsets) {
      path += `/statefulsets/${statefulsets}`
    }
    if (pods) {
      path += `/pods/${pods}`
    }

    return path
  }

  store = {
    cluster: this.clusterStore,
    nodes: this.nodeStore,
    workspaces: this.workspaceStore,
    namespaces: this.namespaceStore,
    applications: this.applicationCrdStore,
    services: this.serviceStore,
    deployments: this.deploymetStore,
    statefulsets: this.statefulsetStore,
    pods: this.podStore,
  }

  getStore = type => {
    return this.store[type]
  }

  handleLabelSelector = params => {
    let labelSelector = ''
    if (!params || isEmpty(params)) return labelSelector
    Object.keys(params).forEach(key => {
      labelSelector += `${key}=${params[key]},`
    })

    labelSelector = labelSelector.slice(0, -1)
    return labelSelector
  }

  getFetchParams = ({
    type,
    cluster,
    namespaces,
    workspaces,
    applications,
    ...params
  }) => {
    const PARAMS_CONFIG = {
      cluster: !globals.app.isMultiCluster
        ? [{ page: 1, limit: -1 }]
        : [
            {
              page: 1,
              limit: -1,
              labelSelector: `cluster-role.kubesphere.io/host`,
            },
            {
              page: 1,
              limit: -1,
              labelSelector: `!cluster-role.kubesphere.io/host`,
            },
          ],
      nodes: [{ limit: -1, page: 1, cluster }],
      workspaces: [
        {
          limit: -1,
          page: 1,
          namespace: namespaces,
          workspace: workspaces,
        },
      ],
      namespaces: [
        {
          page: 1,
          limit: -1,
          cluster,
          namespace: namespaces,
          workspace: workspaces,
        },
      ],
      applications: [
        {
          page: 1,
          limit: -1,
          workspace: workspaces,
          cluster,
          namespace: namespaces,
          application: applications,
        },
      ],
      services: [
        {
          page: 1,
          limit: -1,
          cluster,
          namespace: namespaces,
        },
      ],
      deployments: [
        {
          page: 1,
          limit: -1,
          cluster,
          namespace: namespaces,
          labelSelector: this.handleLabelSelector(params.labelSelector),
        },
      ],
      statefulsets: [
        {
          page: 1,
          limit: -1,
          cluster,
          namespace: namespaces,
          labelSelector: this.handleLabelSelector(params.labelSelector),
        },
      ],
      pods: [
        {
          page: 1,
          limit: -1,
          cluster,
          namespace: namespaces,
          labelSelector: this.handleLabelSelector(params.labelSelector),
          nodeName: params.nodes,
          ownerKind: params.statefulsets
            ? 'StatefulSet'
            : params.deployments
            ? 'ReplicaSet'
            : undefined,
        },
      ],
    }
    return PARAMS_CONFIG[type]
  }

  getListConfig = type => {
    const LIST_CONFIG = {
      cluster: !globals.app.isMultiCluster
        ? [
            {
              status: item => (item.isReady ? 'ready' : 'stop'),
              desc: 'Host Cluster',
            },
          ]
        : [
            {
              status: item => (item.isReady ? 'ready' : 'stop'),
              desc: 'Host Cluster',
            },
            {
              status: item => (item.isReady ? 'ready' : 'stop'),
              desc: 'Member Cluster',
            },
          ],
      nodes: [
        {
          status: item => getNodeStatus(item),
          desc: RESOURCE_TITLE[type],
        },
      ],
      workspaces: [
        {
          desc: RESOURCE_TITLE[type],
        },
      ],
      namespaces: [
        {
          status: item => item.status,
          desc: RESOURCE_TITLE[type],
        },
      ],
      applications: [
        {
          status: item => item.status || '',
          desc: RESOURCE_TITLE[type],
        },
      ],

      services: [
        {
          desc: RESOURCE_TITLE[type],
        },
      ],
      deployments: [
        {
          status: item => {
            const { status } = getWorkloadStatus(item.status, type)
            return status
          },
          desc: RESOURCE_TITLE[type],
        },
      ],
      statefulsets: [
        {
          status: item => {
            const { status } = getWorkloadStatus(item.status, type)
            return status
          },
          desc: RESOURCE_TITLE[type],
        },
      ],
      pods: [
        {
          status: item => get(item, 'podStatus.status', ''),
          desc: RESOURCE_TITLE[type],
        },
      ],
    }
    return LIST_CONFIG[type]
  }

  hasNameSpacesType(type) {
    const nameSpaceType = ['services', 'deployments', 'statefulsets', 'pods']
    return nameSpaceType.indexOf(type) > -1
  }

  filterListByType = ({ type, ...params }) => {
    if (
      params.applications &&
      (type === 'services' || type === 'deployments' || type === 'statefulsets')
    ) {
      return item => {
        return item.app === params.applications
      }
    }

    if (
      type === 'services' ||
      type === 'deployments' ||
      type === 'statefulsets'
    ) {
      return item => !item.app
    }

    if (
      (params.services || params.deployments || params.statefulsets) &&
      type === 'pods' &&
      isEmpty(params.labelSelector)
    ) {
      return () => false
    }

    return () => true
  }

  filterSamePodsWorkload = async ({ type, data, ...rest }) => {
    if (type === 'deployments' || type === 'statefulsets') {
      const workloadData = []

      data.forEach(item => {
        workloadData.push({
          name: item.name,
          labelSelector: item.labelSelector,
        })
      })

      if (isEmpty(workloadData)) {
        return data
      }

      const serviceRequestList = []

      workloadData.forEach(item => {
        serviceRequestList.push(
          this.serviceStore.fetchListByK8s({
            cluster: rest.cluster,
            namespace: rest.namespaces,
            module: 'services',
            labelSelector: this.handleLabelSelector(item.labelSelector),
          })
        )
      })

      const servicesList = await Promise.all(serviceRequestList)
      let result = cloneDeep(data)

      if (!isEmpty(servicesList)) {
        servicesList.forEach(serviceList => {
          if (!isEmpty(serviceList)) {
            serviceList.forEach(service => {
              result = result.filter(_data => _data.name !== service.name)
            })
          }
        })
      }
      return result
    }
    return data
  }

  @action
  fetchList = async ({ type, ...rest }) => {
    const store = this.getStore(type)
    const params = this.getFetchParams({ type, ...rest })
    const listConfig = this.getListConfig(type)
    const requestList = []

    params.forEach(request => {
      if (Object.prototype.toString.call(store) === '[object Array]') {
        store.forEach(_store => {
          requestList.push(_store.fetchList({ ...request }))
        })
      } else {
        requestList.push(store.fetchList({ ...request }))
      }
    })

    const repList = await Promise.all(requestList)
    const data = []

    if (!isEmpty(repList) && isArray(repList)) {
      repList.forEach((rep, index) => {
        rep.forEach(item => {
          if (
            !this.hasNameSpacesType(type) ||
            (this.hasNameSpacesType(type) &&
              this.filterListByType({ type, ...rest })(item))
          ) {
            const { status, desc } = listConfig[index]

            data.push({
              icon: ICON_TYPES[type],
              name: item.name,
              status: status ? status(item) : undefined,
              desc: t(desc),
              createTime: item.createTime,
              labelSelector: item.selector,
              type,
              _origin: { ...item },
            })
          }
        })
      })
    }

    const result = this.filterSamePodsWorkload({ type, data, ...rest })
    this.list = result
    return result
  }
}
