#!/bin/bash

# Privacy Browser Deployment Script
# This script automates the deployment process for production hosting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="privacy-browser"
DOMAIN=""
EMAIL=""
ENVIRONMENT="production"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists docker; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command_exists docker-compose; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to setup environment
setup_environment() {
    print_status "Setting up environment..."
    
    if [ ! -f "Backend/.env" ]; then
        if [ -f "Backend/env.production.template" ]; then
            print_warning "No .env file found. Creating from template..."
            cp Backend/env.production.template Backend/.env
            print_warning "Please edit Backend/.env with your actual values before continuing"
            read -p "Press Enter after editing the .env file..."
        else
            print_error "No .env template found. Please run setup_environment.py first."
            exit 1
        fi
    fi
    
    # Create SSL directory
    mkdir -p ssl
    
    print_success "Environment setup completed"
}

# Function to generate SSL certificates
generate_ssl_certificates() {
    print_status "Setting up SSL certificates..."
    
    if [ -z "$DOMAIN" ]; then
        print_warning "No domain specified. Using self-signed certificates for local development."
        
        # Generate self-signed certificate
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ssl/key.pem -out ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        
        print_success "Self-signed SSL certificates generated"
    else
        print_status "Domain specified: $DOMAIN"
        print_warning "Please place your SSL certificates in the ssl/ directory:"
        print_warning "  - ssl/cert.pem (your SSL certificate)"
        print_warning "  - ssl/key.pem (your private key)"
        read -p "Press Enter after placing SSL certificates..."
    fi
}

# Function to build and start services
deploy_services() {
    print_status "Building and starting services..."
    
    # Build images
    print_status "Building Docker images..."
    docker-compose -f docker-compose.prod.yml build
    
    # Start services
    print_status "Starting services..."
    docker-compose -f docker-compose.prod.yml up -d
    
    print_success "Services deployed successfully"
}

# Function to check service health
check_health() {
    print_status "Checking service health..."
    
    # Wait for services to be ready
    sleep 10
    
    # Check backend health
    if curl -f http://localhost:8000/health >/dev/null 2>&1; then
        print_success "Backend is healthy"
    else
        print_error "Backend health check failed"
        return 1
    fi
    
    # Check frontend health
    if curl -f http://localhost:3000/health >/dev/null 2>&1; then
        print_success "Frontend is healthy"
    else
        print_warning "Frontend health check failed (this might be normal)"
    fi
    
    print_success "Health checks completed"
}

# Function to show deployment info
show_deployment_info() {
    print_success "Deployment completed successfully!"
    echo
    echo "Your Privacy Browser is now running at:"
    echo "  - Frontend: http://localhost:3000"
    echo "  - Backend API: http://localhost:8000"
    echo "  - Nginx Proxy: http://localhost (redirects to HTTPS)"
    echo
    echo "To view logs:"
    echo "  - All services: docker-compose -f docker-compose.prod.yml logs -f"
    echo "  - Backend only: docker-compose -f docker-compose.prod.yml logs -f backend"
    echo "  - Frontend only: docker-compose -f docker-compose.prod.yml logs -f frontend"
    echo
    echo "To stop services:"
    echo "  docker-compose -f docker-compose.prod.yml down"
    echo
    echo "To update and redeploy:"
    echo "  docker-compose -f docker-compose.prod.yml down"
    echo "  docker-compose -f docker-compose.prod.yml up -d --build"
}

# Function to cleanup on error
cleanup() {
    print_error "Deployment failed. Cleaning up..."
    docker-compose -f docker-compose.prod.yml down --volumes --remove-orphans 2>/dev/null || true
    exit 1
}

# Main deployment function
main() {
    echo "=========================================="
    echo "Privacy Browser Deployment Script"
    echo "=========================================="
    echo
    
    # Set error handling
    trap cleanup ERR
    
    # Check prerequisites
    check_prerequisites
    
    # Setup environment
    setup_environment
    
    # Generate SSL certificates
    generate_ssl_certificates
    
    # Deploy services
    deploy_services
    
    # Check health
    check_health
    
    # Show deployment info
    show_deployment_info
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --email)
            EMAIL="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --domain DOMAIN    Domain name for SSL certificates"
            echo "  --email EMAIL      Email for SSL certificate notifications"
            echo "  --environment ENV  Deployment environment (default: production)"
            echo "  --help            Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run main deployment
main
