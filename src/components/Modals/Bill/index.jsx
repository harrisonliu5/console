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
import { action, observable } from 'mobx'
import { isEmpty, set } from 'lodash'

import Modal from 'components/Base/Modal/modal'
import EmptyList from 'components/Cards/EmptyList'
import styles from './index.scss'
import Home from './Home'
import Details from './Details'
import { CARD_CONFIG } from './constats'

@observer
export default class BillModal extends React.Component {
  @observable
  type = ''

  @observable
  nav = []

  get isWorkspace() {
    return (
      !this.isPlatformAdmin &&
      globals.app.getActions({ module: 'workspaces' }).includes('create')
    )
  }

  get isPlatformAdmin() {
    return globals.app.isPlatformAdmin
  }

  get isMultiCluster() {
    return !this.isPlatformAdmin && globals.app.isMultiCluster
  }

  renderEmpty = () => {
    return (
      <div className={styles.empty}>
        <EmptyList
          className={styles.empty__Container}
          title={t('USER_DASHBOARD_EMPTY_TITLE')}
          desc={t('USER_DASHBOARD_EMPTY_DESC')}
        />
      </div>
    )
  }

  contentConfig = () => ({
    home: {
      Component: Home,
      props: {
        handleSelected: this.handleSelected,
      },
    },
    detail: {
      Component: Details,
      props: {
        handleBack: this.handleBack,
      },
    },
    empty: {
      Component: this.renderEmpty,
    },
  })

  @action
  handleSelected = type => {
    this.type = type
  }

  handleBack = () => {
    if (this.isWorkspace || this.isMultiCluster) {
      return
    }

    this.type = undefined
  }

  renderContent = () => {
    const componentsData = this.contentConfig()

    if (!this.type) {
      let cardConfigRule = CARD_CONFIG

      if (this.isMultiCluster) {
        cardConfigRule = CARD_CONFIG.filter(item => item.type === 'cluster')
        this.type = 'cluster'
        return componentsData.detail
      }

      if (this.isWorkspace) {
        if (isEmpty(globals.user.workspaces)) {
          return componentsData.empty
        }
        cardConfigRule = CARD_CONFIG.filter(item => item.type === 'workspaces')
        this.type = 'workspaces'
        return componentsData.detail
      }

      if (!globals.app.enableAppStore) {
        cardConfigRule = CARD_CONFIG.filter(item => item.type !== 'openpitrix')
      }

      set(componentsData, 'home.props.cardConfigRule', cardConfigRule)

      return componentsData.home
    }

    return componentsData.detail
  }

  render() {
    const { Component, props } = this.renderContent()
    const { title, icon, description, onCancel } = this.props

    return (
      <Modal
        visible
        fullScreen
        hideFooter
        title={title}
        icon={icon}
        description={description}
        onCancel={onCancel}
        className={styles.billContainer}
        headerClassName={styles.billModalHeader}
        bodyClassName={styles.billContent}
      >
        <div className={styles.bill}>
          <Component type={this.type} {...props} />
        </div>
      </Modal>
    )
  }
}
