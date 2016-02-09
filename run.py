#!/usr/bin/env python

import logging

from server import app

DEBUG = True


if __name__ == '__main__':
    log_level = 'DEBUG' if DEBUG else 'WARNING'
    # logging.basicConfig(level=log_level)
    app.run(debug=DEBUG, port=5000, threaded=True)
