activate_this = '/var/www/dcc-file-transfer/.virtualenv/bin/activate_this.py'
execfile(activate_this, dict(__file__=activate_this))

import sys
import logging
from server import app as application

log_handler = logging.StreamHandler(stream=sys.stderr)
log_handler.setLevel(logging.WARNING)
application.logger.addHandler(log_handler)

application.logger.error("Don't stop")
print('... beliving')

