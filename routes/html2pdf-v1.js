'use strict';


const sUtil = require('../lib/util');

// shortcut
const HTTPError = sUtil.HTTPError;


/**
 * The main router object
 */
const router = sUtil.router();

/**
 * The main application object reported when this module is require()d
 */
let app;


const puppeteer = require('puppeteer');

/**
 * Renders content from `url` in PDF
 *
 * @param {string} url URL to get content from
 * @param {string} format Page size, e.g. Letter or A4, passed to understands
 * @return {<Promise<Buffer>>} Promise which resolves with PDF buffer
 */
function articleToPdf(url, format) {
    return new Promise((resolve, reject) => {
        puppeteer.launch({ args: app.conf.puppeteer_flags }).then(
            function(browser) {
                browser.newPage().then(function(page) {
                    page.goto(url, { waitUntil: 'networkidle' }).then(function() {
                        const options = Object.assign(
                            {}, app.conf.pdf_options, { format: format }
                        );
                        page.pdf(options).then(function(pdf) {
                            resolve(pdf);
                            browser.close();
                        }).catch(function(error) {
                            app.logger.log('trace/error', {
                                msg: `Cannot convert page ${url} to PDF: ${error}`
                            });
                        });
                    }).catch(function(error) {
                        app.logger.log('trace/error', {
                            msg: `Cannot open URL ${url}: ${error}`
                        });
                    });
                }).catch(function(error) {
                    app.logger.log('trace/error', {
                        msg: `Cannot open new page: ${error}`
                    });
                });
            }).catch(function(error) {
                app.logger.log('trace/error', {
                    msg: `Cannot launch puppeteer: ${error}`
                });
            });
    });
}

function getContentDisposition(title) {
    const encodedName = `${encodeURIComponent(title)}.pdf`;
    const quotedName = `"${encodedName.replace(/"/g, '\\"')}"`;
    return `download; filename=${quotedName}; filename*=UTF-8''${encodedName}`;
}

/**
 * Returns PDF representation of the article
 */
router.get('/:title/:format(Letter|A4)', function(req, res) {
    const restbase_request = app.restbase_tpl.expand({
        request: {
            params: {
                domain: req.params.domain,
                path: 'page/html/' + req.params.title
            }
        }
    });

    const headers = {
        'Content-Type': 'application/pdf',
        'Content-Disposition': getContentDisposition(req.params.title)
    };

    articleToPdf(restbase_request.uri, req.params.format).then(pdf => {
        res.writeHead(200, headers);
        res.end(pdf, 'binary');
    });
});


module.exports = function(appObj) {


    app = appObj;

    // the returned object mounts the routes on
    // /{domain}/vX/mount/path
    return {
        path: '/pdf',
        api_version: 1,      // must be a number!
        router: router
    };

};
