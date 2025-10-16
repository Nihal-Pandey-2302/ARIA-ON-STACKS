#!/usr/bin/env bash
# exit on error
set -o errexit

# Add a command to install system dependencies
# apt-get update refreshes the package list
# apt-get install -y libzbar0 installs the QR code scanning library
apt-get update && apt-get install -y libzbar0

# Install Python dependencies
pip install -r requirements.txt

# Install Node.js and dependencies for the minting script
npm install