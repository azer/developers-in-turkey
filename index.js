const provinces = require("./provinces-in-turkey")
const districts = require("./districts-in-turkey")
const loop = require("limited-parallel-loop")
const get = require('simple-get')
const fs = require("fs")
const log = require("single-line-log").stderr
let cache

const PARALLEL_LIMIT = process.env.PARALLEL_LIMIT || 1 // Requests at a time

if (require.main === module) {
  pull(provinces, function (err, results) {
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
  return `| [${row.city}](https://github.com/search?q=location:${row.city}) | ${row.count} |`
}

function pull (cities, callback) {
  const results = []

  log("Starting...")

  // cities = cities.filter(city => city.district !== city.province)

  loop(cities.length, PARALLEL_LIMIT, each, err => {
    if (err) return callback(err)
    save(results)
    callback(undefined, results.sort(sortByCount))
  })

  function each (done, index) {
    const location = cities[index].district || cities[index]

    getGithubUserCount(location, (err, count) => {
      if (err) {
        save()
        return console.error('Rate limit exceeded')
      }

      log(`> ${location}: ${count}`)

      results.push({
        city: location,
        count: count
      })

      done()
    })
  }
}

function getGithubUserCount (location, callback) {
  const cached = getFromCache(location)

  if (cached && cache.count !== undefined) {
    return callback(undefined, cached.count)
  }

  const request = {
    url: encodeURI(`https://${auth()}api.github.com/search/users?q=location:` + location),
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

    cache.push({
      city: location,
      count: parsed.total_count
    })

    save()

    callback(undefined, parsed.total_count)
  })
}

function getFromCache (location) {
  if (!cache) {
    try {
      cache = require("./cache.json")
    } catch (err) {
      cache = []
      return
    }
  }

  return cache.filter(row => row.city === location)[0]
}

function sortByCount (a, b) {
  if (a.count < b.count) return 1
  if (a.count > b.count) return -1
  return 0
}

function save() {
  fs.writeFile('./cache.json', JSON.stringify(cache, null, "\t"), function (err) {
    // saved
  })
}

function auth () {
  // Add your personal auth tokens, e.g
  // username:token@
  const tokens = [
    ""
  ]

  return tokens[Math.floor(Math.random() * tokens.length)]
}
