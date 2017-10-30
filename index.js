#!/usr/bin/env node
const clc = require('cli-color')

const data = require('caniuse-db/fulldata-json/data-2.0.json')
const agents = ['ie', 'edge', 'firefox', 'chrome', 'safari', 'opera', 'ios_saf', 'op_mini', 'android', 'and_chr']
const defaultItemWidth = 6
const eras = [-3, -2, -1, 0, 1, 2, 3]

const getAgentVersionByEra = (agent, era) => {
  try {
    return data['agents'][agent].version_list
      .find((item) => item.era == era).version
  } catch (error) {
    undefined
  }
}

const columnWidths = agents.reduce((collection ,agent) => {
  let agentAbbr = data['agents'][agent].abbr

  let width = agentAbbr.length > defaultItemWidth ? agentAbbr.length : defaultItemWidth

  // calculate max required width for agent
  let maxWidth = eras.reduce((max, era) => {
    try {
      let width = getAgentVersionByEra(agent, era).length
      return width > max ? width : max;
    } catch (error) {
      return max
    }
  })

  return {
    ...collection,
    [agent]: maxWidth > width ? maxWidth : width
  }
}, {})


const strRepeat = (str, qty) => {
  if (qty < 1) return ''
  var result = ''
  while (qty > 0) {
    if (qty & 1) result += str
    qty >>= 1, str += str
  }
  return result
}

const padCenter = (str, length, padStr) => {
  let padLen = length - str.length
  return strRepeat(padStr, Math.ceil(padLen/2)) + str + strRepeat(padStr, Math.floor(padLen/2))
}

const printTableHeader = () => {
  agents.forEach((agent) => {
    process.stdout.write(clc.black.bgWhite(padCenter(data['agents'][agent].abbr, columnWidths[agent], ' ')))
    process.stdout.write(' ')
  })

  process.stdout.write("\n")
}



const printTableRowItem = (agent, version, data) => {
  let text = padCenter(version, columnWidths[agent], ' ')

  if (data === "y") {
    process.stdout.write(clc.white.bgGreen(text))
  } else {
    process.stdout.write(clc.white.bgRed(text))
  }
}

const printTableRow = (item, era) => {
  agents.forEach((agent, index) => {
    let version = getAgentVersionByEra(agent, era)
    if(version !== undefined) {
      let data = item['stats'][agent][version]
      printTableRowItem(agent, version, data)
    } else {
      process.stdout.write(padCenter('', 6, ' ')) // space between items
    }

    if(index < agents.length-1) {
      if(era === 0) {
        process.stdout.write(clc.bgBlackBright(' '))
      } else {
        process.stdout.write(' ')
      }
    }
  })

  process.stdout.write("\n")
}

let item = data['data'][process.argv[2]]

printTableHeader()
eras.forEach((era) => printTableRow(item, era))
