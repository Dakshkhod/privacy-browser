#!/bin/bash
echo "Installing Python dependencies..."
cd Backend
pip install -r requirements.txt
cd ..
echo "Build completed successfully!"
