function bytesToSize (bytes) {
  var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) { return '0' }
  var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)))
  var decimals = Math.max(0, i - 1)
  return (bytes / Math.pow(1024, i)).toFixed(decimals) + ' ' + sizes[i]
}

function msToTime (ms) {
  if (ms === 0) {
    return '0'
  }
  var decimals = 0
  var unit = ''
  var amount = 0
  if (ms < 1000 * 60) {
    decimals = 1
    unit = 'sec'
    amount = ms / 1000
  } else if (ms < 1000 * 60 * 60) {
    decimals = 1
    unit = 'min'
    amount = ms / 1000 / 60
  } else if (ms < 1000 * 60 * 60 * 24) {
    decimals = 1
    unit = 'h'
    amount = ms / 1000 / 60 / 60
  } else if (ms < 1000 * 60 * 60 * 24 * 7) {
    decimals = 2
    unit = 'd'
    amount = ms / 1000 / 60 / 60 / 24
  } else {
    decimals = 2
    unit = 'w'
    amount = ms / 1000 / 60 / 60 / 24 / 7
  }
  return amount.toFixed(decimals) + '' + unit
}

var dates = {
  convert: function (d) {
    // Converts the date in d to a date-object. The input can be:
    //   a date object: returned without modification
    //  an array      : Interpreted as [year,month,day]. NOTE: month is 0-11.
    //   a number     : Interpreted as number of milliseconds
    //                  since 1 Jan 1970 (a timestamp)
    //   a string     : Any format supported by the javascript engine, like
    //                  "YYYY/MM/DD", "MM/DD/YYYY", "Jan 31 2009" etc.
    //  an object     : Interpreted as an object with year, month and date
    //                  attributes.  **NOTE** month is 0-11.
    return (
    d.constructor === Date ? d
      : d.constructor === Array ? new Date(d[0], d[1], d[2])
        : d.constructor === Number ? new Date(d)
          : d.constructor === String ? new Date(d)
            : typeof d === 'object' ? new Date(d.year, d.month, d.date) : NaN
    )
  },
  compare: function (a, b) {
    // Compare two dates (could be of any type supported by the convert
    // function above) and returns:
    //  -1 : if a < b
    //   0 : if a = b
    //   1 : if a > b
    // NaN : if a or b is an illegal date
    // NOTE: The code inside isFinite does an assignment (=).
    return (
    isFinite(a = this.convert(a).valueOf()) &&
    isFinite(b = this.convert(b).valueOf())
      ? (a > b) - (a < b)
      : NaN
    )
  },
  inRange: function (d, start, end) {
    // Checks if date in d is between dates in start and end.
    // Returns a boolean or NaN:
    //    true  : if d is between start and end (inclusive)
    //    false : if d is before start or after end
    //    NaN   : if one or more of the dates is illegal.
    // NOTE: The code inside isFinite does an assignment (=).
    return (
    isFinite(d = this.convert(d).valueOf()) &&
    isFinite(start = this.convert(start).valueOf()) &&
    isFinite(end = this.convert(end).valueOf())
      ? start <= d && d <= end
      : NaN
    )
  }
}

module.exports.bytesToSize = bytesToSize
module.exports.msToTime = msToTime
module.exports.dates = dates
