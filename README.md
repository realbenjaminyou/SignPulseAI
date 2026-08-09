# SignPulseAI

## Real-Time Zero-Latency Sign Language and Gesture Voice Translator

SignPulseAI is a real-time AI-powered application designed to interpret sign language and hand gestures captured through a live camera feed and convert them into understandable text and synthesized voice.

The system combines a low-latency computer vision pipeline with Gemini multimodal APIs to process visual gestures and produce real-time text and audio translations.

---

## Project Overview

SignPulseAI takes a live camera feed containing sign language or hand gestures and processes the incoming frames through a low-latency gesture-processing pipeline.

The interpreted gesture is then converted into text and synthesized audio, creating a direct interaction between visual gestures and spoken output.

### Core Workflow

Camera / Webcam
↓
Live Frame Capture
↓
Frame & Gesture Sequence Processing
↓
Gemini Multimodal AI
↓
Gesture Interpretation
↓
Text Translation
↓
Text-to-Speech
↓
Real-Time Audio Output

---

## Problem

Communication can become difficult when people who communicate through sign language interact with people who do not understand sign language.

Traditional communication may require another person to interpret the signs, which can introduce delays and make spontaneous communication more difficult.

SignPulseAI explores a real-time AI-based approach for transforming visual signs and gestures into understandable text and synthesized speech.

---

## Solution

SignPulseAI provides a camera-based interface where users can perform sign language or hand gestures.

The system processes the live visual input through a low-latency computer vision pipeline and Gemini multimodal APIs. The interpreted gestures are converted into readable text and synthesized audio.

The core communication workflow is:

**Visual Gesture → AI Interpretation → Text → Voice**

The project focuses on achieving a responsive interaction with low-latency gesture-to-speech processing.

---

## Key Features

- Real-time camera input
- Live frame extraction and processing
- Gesture sequence processing
- Hand gesture and sign interpretation
- Gemini multimodal AI integration
- Real-time text translation
- Synthesized voice output
- Low-latency processing pipeline
- Live video and audio output interface
- Real-time interaction between visual input and generated output

---

## Technology Stack

The project uses the following technologies and components:

- Gemini Multimodal APIs
- Computer Vision / Gesture Processing
- FastAPI
- WebSockets
- Docker
- Real-time camera/video processing
- Text-to-Speech

---

## System Workflow

The application follows a low-latency real-time processing pipeline.

### 1. Camera Input

The user provides a live camera feed containing sign language or hand gestures.

### 2. Frame Extraction

The incoming video stream is processed to extract frames for gesture analysis.

### 3. Gesture Sequence Processing

The extracted frames are processed as gesture sequences and optimized for low-latency input to the translation system.

### 4. Gemini Multimodal Interpretation

The processed visual information is provided to Gemini multimodal APIs for gesture interpretation.

### 5. Text Translation

The interpreted gesture is converted into understandable text.

### 6. Text-to-Speech

The generated text is converted into synthesized audio for real-time voice output.

### 7. Frontend Output

The frontend provides the primary interface for displaying the live video and presenting the generated text and audio output.

---

## Frontend

The frontend provides the primary user interface for interacting with SignPulseAI.

Users can:

- View the live camera/video feed
- See the real-time translation output
- Access the generated audio output
- Follow the translation process in real time

The frontend is centered around the core interaction:

**Camera → Gesture Processing → AI Interpretation → Text → Audio**

---

# Team & Responsibilities

SignPulseAI is developed by a four-member team, with each member responsible for a specific area of the system.

## Hammad — Lead Data Pipeline Engineer

Hammad is responsible for the data-processing side of the system.

### Responsibilities

- Frame extraction
- Gesture sequence data processing
- Processing the incoming visual input
- Optimizing the input stream
- Preparing the input stream for the translation model

---

## Fisiha — DevOps & Infrastructure Lead

Fisiha is responsible for the infrastructure and deployment side of the project.

### Responsibilities

- Containerizing the application
- Deploying the low-latency backend streaming server
- Setting up API endpoints
- Supporting backend infrastructure
- Assisting with frontend interface polish

---

## Basit Ali — Frontend & Documentation Lead

Basit is responsible for the primary user interface and project documentation.

### Responsibilities

- Developing the primary user interface
- Rendering the live video output
- Rendering the live audio output
- Building the frontend interaction experience
- Preparing pitch presentation slides
- Preparing the hackathon submission write-up
- Preparing and maintaining the project README
- Documenting the project workflow and implementation

---

## Benjamin You — Systems Architecture & AI Integration

Benjamin is responsible for the overall system architecture and AI integration.

### Responsibilities

- Systems architecture
- Gemini multimodal API integration
- Optimizing low-latency gesture-to-speech prompt workflows
- Connecting the end-to-end system logic
- Coordinating the integration between the major system components

---

## End-to-End Architecture

The overall system can be represented as:

Camera
↓
Frame Extraction
↓
Gesture Sequence Processing
↓
Low-Latency Input Stream
↓
Gemini Multimodal AI
↓
Gesture Interpretation
↓
Text Generation
↓
Text-to-Speech
↓
Frontend
↓
Live Text + Audio Output

---

## Purpose

The purpose of SignPulseAI is to explore how multimodal AI and real-time computer vision can be used to make visual communication more accessible.

By connecting live gesture input with AI interpretation, text generation, and synthesized speech, the project aims to provide a more direct and responsive communication experience.

---

## Hackathon

SignPulseAI is being developed as a submission for the **Lablab AI Hackathon**.

---

## Repository

**Project:** SignPulseAI

The team uses feature-based development branches so that each member can work independently on their assigned area before integrating changes into the main project.
