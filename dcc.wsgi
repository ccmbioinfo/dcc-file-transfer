activate_this = '/var/www/dcc-file-transfer/.virtualenv/bin/activate_this.py'
execfile(activate_this, dict(__file__=activate_this))

import os
import sys
import logging


log_handler = logging.StreamHandler(stream=sys.stderr)
log_handler.setLevel(logging.WARNING)

# Response handler gets called to dispatch each thread
def application(environ, start_response):
    # Pass through Apache environment variables into Python environment
    for key in ['APP_SETTINGS']:
        os.environ[key] = environ.get(key, '')

    # App must be imported after setting os environment variables
    from server import app as _application
    _application.logger.addHandler(log_handler)

    return _application(environ, start_response)

print("Don't stop... believing")
