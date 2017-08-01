const provinces = require("./provinces-in-turkey")
const loop = require("limited-parallel-loop")
const get = require('simple-get')
const fs = require("fs")
const log = require("single-line-log").stderr
const cache = require("./cache.json")

const PARALLEL_LIMIT = process.env.PARALLEL_LIMIT || 1 // Requests at a time

if (require.main === module) {
  pull(function (err, results) {
    if (err) throw err
    console.log(formatAsTable(results))
  })
}

module.exports = pull

function formatAsTable (results) {
  return `
| City | Github User |
| ---- | ----------- |
${results.filter(row => row.count > 0).map(formatAsTableRow).join('\n')}
`
}

function formatAsTableRow (row) {
  return `| ${row.city} | ${row.count} |`
}

function pull (callback) {
  const results = []

  log("Starting...")

  loop(provinces.length, PARALLEL_LIMIT, each, err => {
    if (err) return callback(err)
    callback(undefined, results.sort(sortByCount))
  })

  function each (done, index) {
    getGithubUserCount(provinces[index], (err, count) => {
      if (err) {
        saveAndExit(results)
        return console.error('Rate limit exceeded')
      }

      log(`> ${provinces[index]}: ${count}`)

      results.push({
        city: provinces[index],
        count: count
      })

      done()
    })
  }
}

function getGithubUserCount (location, callback) {
  const cached = cache.filter(row => row.city === location)[0]
  if (cached) {
    return callback(undefined, cached.count)
  }

  const request = {
    url: encodeURI('https://api.github.com/search/users?q=location:' + location),
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
    }
  }

  get.concat(request, (err, res, data) => {
    if (err) return callback(err)

    let parsed = null
    try {
      parsed = JSON.parse(data.toString())
    } catch (err) {
      callback(err)
      return
    }

    if (parsed.total_count === undefined) {
      callback(new Error('rate limit exceeded'))
    }

    callback(undefined, parsed.total_count)
  })
}

function sortByCount (a, b) {
  if (a.count < b.count) return 1
  if (a.count > b.count) return -1
  return 0
}

function saveAndExit(results) {
  fs.writeFile('./cache.json', JSON.stringify(results), function (err) {
    console.log('Saved latest numbers to cache.')
    process.exit()
  })
}
