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

import { getLocalTime } from 'utils'
import { Select, DatePicker } from '@pitrix/lego-ui'
import { Notify } from 'components/Base'

import { getTimeOptions } from 'components/Cards/Monitoring/Controller/TimeSelector/utils'
import cookie from 'utils/cookie'

import styles from './index.scss'

const TimeOps = ['1h', '2h', '5h', '8h', '1d']

const format = cookie('lang') === 'zh' ? 'Y年Md日 H:i' : 'M d, Y H:i'
const timeFormat =
  cookie('lang') === 'zh' ? 'YYYY年MM月DD日 HH:mm' : 'MMM DD, YYYY HH:mm'

export default class TimeSelect extends React.Component {
  constructor(props) {
    super(props)

    const { timeRange } = this.props
    const end = timeRange.end || new Date()
    this.maxDate = new Date(end)
    this.minDate = new Date(timeRange.start)
  }

  getTimeRange = ({ type, methord }) => selectedDates => {
    const { getTime, timeRange } = this.props
    const { end, start } = timeRange
    const time = new Date(selectedDates[0]).getTime()

    if ((type === 'start' && time > end) || (type === 'end' && time < start)) {
      Notify.error({ content: t('TIMERANGE_SELECTOR_MSG') })
      return
    }

    getTime({ type, value: time, methord })
  }

  handleStepChange = ({ type, methord }) => value => {
    const _step = value
    const { getTime, timeRange } = this.props
    const { end, start } = timeRange

    const day = Math.floor((end - start) / 3600 / 24 / 1000)

    if (day >= 30 && _step !== '1d') {
      Notify.error({ content: t('TIMERANGE_MORE_30DAY_MSG') })
      return
    }

    getTime({ type, value: _step, methord })
  }

  handleTimeRangeChange = type => selectedDates => {
    const { getTime, timeRange } = this.props
    const { end, start, step } = timeRange
    const time = new Date(selectedDates[0]).getTime()

    if ((type === 'start' && time > end) || (type === 'end' && time < start)) {
      Notify.error({ content: t('TIMERANGE_SELECTOR_MSG') })
      return
    }

    if (type === 'start') {
      const day = Math.floor((end - time) / 3600 / 24 / 1000)
      if (day >= 30 && step !== '1d') {
        getTime({ type: 'step', value: '1d', methord: 'change' })
      }
    }

    if (type === 'end') {
      const day = Math.floor((time - start) / 3600 / 24 / 1000)
      if (day >= 30 && step !== '1d') {
        getTime({ type: 'step', value: '1d', methord: 'change' })
      }
    }
    getTime({ type, value: time, methord: 'change' })
  }

  render() {
    const { createTime, timeRange } = this.props
    const { step, start, end } = timeRange

    const createTimeStr = createTime
      ? getLocalTime(createTime).format(timeFormat)
      : '-'

    return (
      <ul className={styles.datepicker}>
        <li>
          <div>{t('Reconciliation Cycle')}</div>
          <p>
            {t('Create Time')}: {createTimeStr}
          </p>
        </li>
        <li>
          <div>
            <DatePicker
              defaultValue={start}
              value={start}
              enableTime
              showClearBtn={false}
              dateFormat={format}
              minDate={this.minDate}
              maxDate={this.maxDate}
              onClose={this.getTimeRange({
                type: 'start',
                methord: 'close',
              })}
              onChange={this.handleTimeRangeChange('start')}
            />
          </div>
          <p>{t('Start Time')}</p>
        </li>
        <li>
          <div>
            <DatePicker
              defaultValue={end}
              value={end}
              enableTime
              showClearBtn={false}
              dateFormat={format}
              minDate={this.minDate}
              maxDate={this.maxDate}
              onClose={this.getTimeRange({
                type: 'end',
                methord: 'close',
              })}
              onChange={this.handleTimeRangeChange('end')}
            />
          </div>
          <p>{t('End Time')}</p>
        </li>
        <li>
          <div>
            <Select
              value={step}
              options={getTimeOptions(TimeOps)}
              onChange={this.handleStepChange({
                type: 'step',
                methord: 'close',
              })}
            />
          </div>
          <p>{t('Time Interval')}</p>
        </li>
      </ul>
    )
  }
}
