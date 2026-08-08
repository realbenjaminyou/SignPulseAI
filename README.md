# SignPulseAI

## Real-Time Zero-Latency Sign Language and Gesture Voice Translator

SignPulseAI is a real-time AI-powered application designed to interpret sign language and gestures captured through a camera and convert them into understandable text and synthesized voice.

The project aims to make communication more accessible by providing a direct interaction between visual gestures and spoken output.

---

## Project Overview

SignPulseAI uses a camera-based input to capture hand signs and gestures in real time. The captured visual information is processed and interpreted using a multimodal AI model.

The recognized meaning is then:

1. Captured through the camera
2. Processed from video frames
3. Interpreted by a multimodal AI model
4. Converted into readable text
5. Displayed to the user
6. Converted into synthesized audio

### Core Workflow

Camera/Webcam
        ↓
Video Frame Capture
        ↓
Visual/Gesture Processing
        ↓
Gemini Multimodal AI
        ↓
Recognized Sign/Gesture
        ↓
Text Output
        ↓
Text-to-Speech
        ↓
Live Audio Output

---

## Problem

Communication can become difficult when people who communicate through sign language interact with people who do not understand sign language.

Traditional translation methods may require another person to interpret the communication. This can introduce delays and make spontaneous communication more difficult.

SignPulseAI explores an AI-based approach where visual signs and gestures can be interpreted and transformed into text and spoken output in real time.

---

## Solution

SignPulseAI provides a camera-based interface through which users can present signs or gestures.

The application processes the visual input and uses Gemini's multimodal capabilities to interpret the captured information. The interpreted result is presented as text and can also be converted into synthesized voice.

The goal is to create a simple and direct communication workflow:

Visual Gesture → AI Interpretation → Text → Voice

---

## Key Features

- Real-time camera/video input
- Sign and gesture interpretation
- Multimodal AI-based processing
- Text output for recognized gestures
- Synthesized voice output
- User interface for viewing video and output
- Real-time interaction between visual input and generated output

---

## Technology Stack

The project workflow uses the following technologies/components:

- Gemini Multimodal AI
- OpenCV for video/frame processing
- FastAPI for backend/API functionality
- WebSockets for real-time communication
- Docker for application/containerization

---

## System Workflow

The application follows a real-time processing pipeline:

### 1. Camera Input

The user provides visual input through a camera/webcam.

### 2. Frame Processing

Video frames are captured and processed for AI interpretation.

### 3. Multimodal AI Interpretation

The visual information is sent for interpretation using Gemini Multimodal AI.

### 4. Text Generation

The interpreted sign or gesture is converted into readable text.

### 5. Voice Output

The resulting text is converted into synthesized audio.

### 6. User Interface

The frontend provides the primary interface for displaying the video input together with the generated text and live audio output.

---

## Frontend

The frontend focuses on providing a clear real-time interface where users can:

- View the camera/video stream
- See the interpreted text
- Access the generated voice output
- Follow the translation process in real time

The frontend is designed around the core interaction:

Camera → AI Interpretation → Text → Audio

---

## Project Role

### Basit Ali — Frontend & Documentation Lead

Responsibilities include:

- Developing the primary user interface
- Rendering the video output
- Rendering the live audio/output experience
- Preparing the pitch presentation
- Preparing the hackathon submission write-up
- Preparing the project README
- Documenting the project workflow and implementation

---

## Repository

Project repository:

SignPulseAI

---

## Purpose

The purpose of SignPulseAI is to explore how multimodal AI can be used to make visual communication more accessible by transforming signs and gestures into text and synthesized voice in a real-time interaction.

---

## Hackathon

This project is being developed for the Lablab AI Hackathon.
