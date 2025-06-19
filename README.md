Disaster Response Coordination Platform - Backend
A comprehensive backend API for coordinating disaster response efforts, built with Node.js, Express, and Supabase. This platform enables real-time disaster reporting, resource management, social media monitoring, and verification services.
🚀 Features
Core Functionality

Disaster Management: Create, update, and track disaster incidents
Real-time Reports: Submit and manage disaster reports with verification
Resource Coordination: Track shelters, medical facilities, supplies, and rescue services
Social Media Monitoring: Aggregate and prioritize social media posts for disaster updates
Geospatial Services: Location-based resource discovery and disaster mapping
Image Verification: AI-powered image authenticity verification
Official Updates: Scrape and aggregate official disaster communications

Technical Features

Real-time Updates: Socket.IO for live data synchronization
Intelligent Geocoding: Multi-provider location services (Google Maps, Mapbox, OSM)
AI Integration: Gemini AI for location extraction and content verification
Caching Layer: Efficient data caching with TTL support
Rate Limiting: Protection against API abuse
Comprehensive Logging: Winston-based logging system
Authentication & Authorization: Role-based access control
Input Validation: Joi schema validation
CORS Support: Cross-origin resource sharing configuration

🛠 Tech Stack

Runtime: Node.js 18.x
Framework: Express.js
Database: Supabase (PostgreSQL)
Real-time: Socket.IO
AI Services: Google Gemini AI
Geocoding: Google Maps API, Mapbox API, OpenStreetMap
Validation: Joi
Logging: Winston
Security: Helmet, CORS
Deployment: Vercel

📋 Prerequisites

Node.js 18.x or higher
npm or yarn
Supabase account and project
API keys for external services (optional but recommended)

🔧 Installation

Clone the repository
bashgit clone <repository-url>
cd disaster-response-backend

Install dependencies
bashnpm install

Environment Setup
bashcp .env.example .env
email id:venktesh.iet.btech@gmail.com
