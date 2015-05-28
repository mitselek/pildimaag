var nomnom          = require('nomnom')
var request         = require('request');
var EventEmitter    = require('events').EventEmitter
var fs              = require('fs')
var util            = require('util')
var path            = require('path')
var stream          = require('stream')

// var http            = require("http");
// var im              = require("imagemagick-stream");
// var im              = require("imagemagick");
// var gm              = require('graphicsmagick-stream')
var gm              = require('gm')

var entulib         = require('./entulib.js')
var helper          = require('./helper.js')

// console.log(process.argv)
var pjson = require('./package.json')
console.log(pjson.name + ' v.' + pjson.version)
// console.log(process)

var opts = nomnom.options({
    USER_ID: {
        abbr     : 'e',
        required : true,
        help     : 'Entity ID for Entu API user'
    },
    API_KEY: {
        abbr     : 'k',
        metavar  : 'STRING',
        required : true,
        help     : 'Authentication key'
    },
}).parse()
opts.HOSTNAME = 'okupatsioon.entu.ee'
// console.log(opts)

HOME_DIR = path.dirname(process.argv[1])
TEMP_DIR = path.resolve(HOME_DIR, 'temp')
PAGE_SIZE_LIMIT = 10
MAX_DOWNLOAD_COUNT = 15
PIC_READ_ENTITY = 'eksponaat'
PIC_READ_PROPERTY = 'photo'
PIC_WRITE_PROPERTY = 'thumb'

var EntuLib = entulib(opts.USER_ID, opts.API_KEY, opts.HOSTNAME)
var connection_counter = 0
var download_counter = 0


ENTU_URI = 'https://' + opts.HOSTNAME + '/'
ENTU_API = ENTU_URI + 'api2/'
ENTU_API_ENTITY = ENTU_API + 'entity-'
ENTU_API_POST_FILE = ENTU_API + 'file/s3'


var fetchNextPage = function fetchNextPage(page) {

    connection_counter ++
    EntuLib.findEntity(PIC_READ_ENTITY, '00000', PAGE_SIZE_LIMIT, page, function findEntityCB(err, result) {
        connection_counter --
        if (err) {
            console.log('findEntityCB: Can\'t reach Entu', err, result)
            process.exit(99)
        }
        else if (result.error !== undefined) {
            console.log (result.error, 'Failed to fetch from Entu.')
        } else {

            console.log('Fetched ' + result.result.length + '/' + result.count
                + ' results on page ' + page + '/' + Math.ceil(result.count / PAGE_SIZE_LIMIT))
            // console.log(result.result)
            result.result.forEach(function entityLoop(entity) {

                connection_counter ++
                EntuLib.getEntity(entity.id, function getEntityCB(err, result) {
                    connection_counter --
                    // console.log('#:' + connection_counter)
                    if (err) {
                        console.log('getEntityCB: Can\'t reach Entu', err, result)
                        process.exit(99)
                    }
                    else if (result.error !== undefined) {
                        console.log (result.error, 'Failed to fetch from Entu.')
                    } else {
                        // console.log(entity.id + ':', result.result.displayname, result.result.displayinfo)
                        var photo_property = result.result.properties[PIC_READ_PROPERTY]
                        var code_value = result.result.properties['code'].values ? result.result.properties['code'].values[0].value : ''
                        var nimetus_value = result.result.properties['tag'].values ? result.result.properties['tag'].values[0].value : ''
                        if (photo_property.values) {
                            photo_property.values.forEach(function photoLoop(photo_val) {
                                // console.log(entity.id + '/' + photo_val.id + '[' + photo_val.db_value + ']:', photo_val.value)
                                var ff = new fetchFile(entity.id, photo_val.db_value, photo_val.value, code_value, nimetus_value)
                                .on('error', function fileFetchError(err_msg, err_no) {
                                    console.log('fetchFile error: ', err_msg, err_no)
                                    process.exit(err_no)
                                })
                            })
                        }
                    }
                })
            })

            if (PAGE_SIZE_LIMIT * page < result.count) {
                console.log('Currently connections: #' + connection_counter + '; downloads: #' + download_counter)
                var fetchIfReady = function fetchIfReady(page) {
                    if (download_counter < MAX_DOWNLOAD_COUNT) {
                        fetchNextPage(page)
                    } else {
                        console.log('Postponing load of page #' + page)
                        setTimeout(function() { fetchIfReady(page) }, 1000)
                    }
                }
                fetchIfReady(page + 1)
            } else {
                console.log('No more pages for today.')
                // process.exit(0)
                // setTimeout(function() { fetchNextPage(1) }, 1000 * 10 * 1 * 1)
                setTimeout(function() { fetchNextPage(1) }, 1000 * 60 * 60 * 24)
            }

        }
    })
}

fetchNextPage(1)

var MAX_DOWNLOAD_TIME = 60 * 60 // seconds
var total_download_size = 0
var bytes_downloaded = 0
var decrementProcessCount = function decrementProcessCount() {
    -- download_counter
}
var incrementProcessCount = function incrementProcessCount() {
    ++ download_counter
}
var countLoadingProcesses = function countLoadingProcesses() {
    return download_counter
}

var append_background = path.resolve(HOME_DIR, 'text_background.png')

var THUMB_TYPE = 'jpg'

var fetchFile = function fetchFile(entity_id, file_id, file_name, exp_nr, nimetus) {
    incrementProcessCount()
    EventEmitter.call(this)
    var self = this

    var t = setTimeout(function() {
        decrementProcessCount()
        self.emit('error', 'Error: ' + file_id + '|' + fetch_uri + '|' + file_name + ' timed out!', 95)
    }, MAX_DOWNLOAD_TIME * 1000)

    var fetch_uri = 'https://' + opts.HOSTNAME + '/api2/file-' + file_id
    var download_filename = path.resolve(TEMP_DIR, file_id + '.' + THUMB_TYPE)

    gm(request
        .get(fetch_uri)
        .on('error', function(err) {
            console.log('request error for: ' + file_id + '|' + fetch_uri + '|' + file_name, err)
            decrementProcessCount()
            fetchFile(entity_id, file_id, file_name, exp_nr, nimetus)
        })
        .on('response', function response_handler( response ) {
            var filesize = response.headers['content-length']
            // console.log(response.headers)
            if (filesize === undefined) {
                console.log(file_id + '|' + fetch_uri + '|' + file_name + ' has no size! Concurrent downloads: #' + download_counter)
                decrementProcessCount()
                setTimeout(function() {
                    fetchFile(file_id, file_name, exp_nr, nimetus)
                }, 1000)
                return
                // self.emit('error', file_id + '|' + fetch_uri + '|' + file_name + ' has no size!', 90)
                // return
            } else {
                total_download_size += Number(filesize)
                // console.log('Downloading: ' + file_id + '|' + fetch_uri + '|' + file_name + ' - ' + filesize + ' bytes.')
            }
            response.on('data', function(chunk) {
                bytes_downloaded += chunk.length
                if (filesize === undefined) {
                    console.log(file_id + '|' + fetch_uri + '|' + file_name + ' loaded chunk of ' + chunk.length + ' bytes.')
                    total_download_size += chunk.length
                    console.log(chunk.toString('utf8'))
                }
                // console.log('Progress: ' + file_name + ' - ' + helper.bytesToSize(total_download_size) + ' - ' + helper.bytesToSize(bytes_downloaded) + ' = ' + helper.bytesToSize(total_download_size - bytes_downloaded) )
            })
            response.on('end', function() {
                if (response.statusCode === 200) {
                    // console.log('Finished: ' + file_id + '|' + fetch_uri + '|' + file_name + ' - ' + helper.bytesToSize(total_download_size) + ' - ' + helper.bytesToSize(bytes_downloaded) + ' = ' + helper.bytesToSize(total_download_size - bytes_downloaded) )
                }
                decrementProcessCount()
                clearTimeout(t)
            })
        })
    )
    .resize(800, 530)
    .stream(THUMB_TYPE, function(err, stdout, stderr) {
        gm(stdout)
        .append(append_background)
        // .append(gm(240, 70))
        .stream(function(err, stdout, stderr) {
            gm(stdout)
            .drawText(0, 15, 'Okupatsioonide Muuseum #' + exp_nr + '\n' + nimetus + '\nokupatsioon.entu.ee', 'south')
            .stream(function(err, stdout, stderr) {
                var f = fs.createWriteStream(download_filename)
                stdout.pipe(f)
                f.on('finish', function() {
                    console.log('bytes written: ' + f.bytesWritten);
                    incrementProcessCount()
                    EntuLib.addFile(entity_id, PIC_READ_ENTITY + '-' + PIC_WRITE_PROPERTY, file_name, 'image/' + THUMB_TYPE, f.bytesWritten, download_filename, function addFileCB(err, result) {
                        decrementProcessCount()
                        if (err) {
                            console.log('addFileCB: ' + file_id + '|' + fetch_uri + '|' + file_name, err, result)
                            process.exit(99)
                        }
                        console.log('Uploaded ' + file_id + '|' + fetch_uri + '|' + file_name)
                    })
                })

            })
        })
    })

}
util.inherits(fetchFile, EventEmitter)


var pulse_cnt = 0
var pulse = function pulse(ms) {
    console.log('tick ' + (pulse_cnt ++))
    setTimeout(function() { pulse(ms) }, ms)
}
pulse(60 * 1000)



/*
BUILD, RUN and LOG
docker kill puhh
docker rm puhh
docker build -t mitselek/pildimaag ~/Documents/github/pildimaag/
docker run -d -v ~/Documents/github/pildimaag/:/pildimaag/ --name puhh mitselek/pildimaag:latest -e 155005 -k 378c2VuY
docker logs -f puhh

RESTART and LOG
docker kill puhh
docker start puhh
docker logs -f --tail=15 puhh
*/
