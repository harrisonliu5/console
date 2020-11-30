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

import { Icon, Checkbox } from '@pitrix/lego-ui'
import classnames from 'classnames'
import { Text, Indicator, Tag } from 'components/Base'

import { get } from 'lodash'
import styles from './index.scss'

export default function Card({
  data,
  activeName,
  getCurrentMeterData,
  getChildrenData,
  getCheckData,
  noIcon,
  style,
  loading,
  isCheck,
}) {
  const { icon, status, desc, name, type, selector, createTime } = data
  const active = activeName === name
  const isLast = type === 'pods'

  const handleChildrenClick = (e, value) => {
    e.stopPropagation()
    noIcon === true || loading ? null : getChildrenData(value)
  }

  const renderCluster = () => {
    if (type !== 'workspaces') {
      return null
    }

    const clusters = get(data, '_origin.clusters', [])

    return (
      <div className={styles.tagContainer}>
        {clusters.map((cluster, index) => (
          <Tag key={index}>
            <Icon name="kubernetes" type="light" size={16} />
            {cluster.name}
          </Tag>
        ))}
      </div>
    )
  }

  return (
    <div
      className={classnames(styles.billCard, {
        [styles.selected]: active,
        [styles.noHover]: noIcon,
      })}
      style={style}
      onClick={() => {
        noIcon === true
          ? null
          : getCurrentMeterData({
              name,
              type,
              createTime,
              labelSelector: selector,
            })
      }}
    >
      {!noIcon ? (
        <div
          className={styles.checkContainer}
          onClick={e => e.stopPropagation()}
        >
          <Checkbox checked={isCheck} onClick={() => getCheckData(name)} />
        </div>
      ) : null}

      <div className={styles.info}>
        <div className={styles.title}>
          <Indicator type={status} className={styles.indicator} />
          <Icon name={icon} size={40} type={active ? 'light' : 'dark'} />
        </div>
        <div className={styles.desc}>
          <Text title={name} description={desc} />
        </div>
        {renderCluster()}
      </div>
      {isLast || noIcon ? null : (
        <div
          className={styles.symbol}
          onClick={e =>
            handleChildrenClick(e, {
              name,
              type,
              createTime,
              labelSelector: selector,
            })
          }
        >
          <Icon
            name="chevron-right"
            type={active ? 'light' : 'dark'}
            size={20}
          />
        </div>
      )}
    </div>
  )
}
