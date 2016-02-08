#!/usr/bin/python

from server import app
app.run(debug=True, port=5000, threaded=True)