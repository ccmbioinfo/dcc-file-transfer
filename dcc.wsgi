activate_this = '/var/www/dcc-file-transfer/.virtualenv/bin/activate_this.py'
execfile(activate_this, dict(__file__=activate_this))

import os
import sys
import logging


log_handler = logging.StreamHandler(stream=sys.stderr)
log_handler.setLevel(logging.WARNING)

def application(environ, start_response):
    # Pass through Apache environment variables into Python environment
    for key in ['APP_SETTINGS']:
        os.environ[key] = environ.get(key, '')

    from server import app as _application
    _application.logger.addHandler(log_handler)

    print("Don't stop... believing")

    return _application(environ, start_response)
