#!/usr/bin/env python

import logging

from server import app

DEBUG = app.config['DEBUG']
logging.basicConfig(filename='/var/log/dcc.log', format='%(asctime)s - %(message)s', datefmt='%Y-%d-%m %H:%M:%S',
                    level='DEBUG' if DEBUG else 'INFO')

if __name__ == '__main__':
    app.run(debug=DEBUG, host=app.config['HOST'], port=app.config['PORT'], threaded=True)
