#!/bin/bash
firefox --kiosk --private-window "http://127.0.0.1:5001/?nocache=$(date +%s)"
