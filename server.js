

if(process.env.NEW_RELIC_LICENSE_KEY) require('newrelic')

var path            = require('path')
var debug           = require('debug')('app:' + path.basename(__filename).replace('.js', ''))
var request         = require('request')
var fs              = require('fs')
var path            = require('path')
var Transform       = require('stream').Transform

var gm              = require('gm')

// var entulib         = require('./entulib.js')
var entu            = require('./entu')
var queue           = require('./queue.js')
var helper          = require('./helper.js')

var async           = require('async')



var pjson = require('./package.json')
console.log('----==== ' + pjson.name + ' v.' + pjson.version + ' ====----')

HOME_DIR = path.dirname(process.argv[1])
TEMP_DIR = path.resolve(HOME_DIR, 'temp')
PIC_READ_DEFINITION = ['eksponaat', 'eksemplar']
PIC_READ_PROPERTY = 'photo-orig'
PIC_WRITE_PROPERTY = 'photo'
VALID_EXTENSIONS = ['.jpg', '.pdf', '.tif', '.tiff', '.png', '.jpeg', '.gif']

APP_ENTU_URL = 'https://okupatsioon.entu.ee/api2'

APP_ENTU_USER = process.env.ENTU_USER
APP_ENTU_KEY = process.env.ENTU_KEY



async.eachSeries(PIC_READ_DEFINITION, function(read_definition, callback) {
    entu.get_entities(read_definition, null, null, null, function(err, op_entities) {
        if (err) {
            debug('Fetch ' + read_definition + ' from Entu failed.', err)
            callback(err)
            return
        }
        async.eachSeries(op_entities, function(op_entity, callback) {
            processEntity(op_entity, callback)
        }, function(err, op_entities) {
            if (err) {
                debug('Processing ' + op_entity.get('id') + ' failed.', err)
                callback(err)
                return
            }
            callback()
        })
    })
}, function(err, op_entities) {
    if (err) {
        debug(err)
        // callback(err)
        return
    }
    // callback()
})

var processEntity = function processEntity(op_entity, callback) {
    debug(JSON.stringify([op_entity.get('id'), op_entity.get('definition')], null, 2))
}
