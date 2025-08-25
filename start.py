#!/usr/bin/env python3
"""
Simple startup script for Railway deployment
"""
import os
import sys

# Add Backend to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'Backend'))

# Change to Backend directory
os.chdir('Backend')

# Import and run the main application
from start_secure import main

if __name__ == "__main__":
    main()
