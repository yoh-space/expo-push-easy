# expo-push-easy Troubleshooting Guide

Common issues and their solutions when using `expo-push-easy`.

## Table of Contents
- [Setup Issues](#setup-issues)
- [Token Registration Issues](#token-registration-issues)
- [Notification Send Issues](#notification-send-issues)
- [Notification Delivery Issues](#notification-delivery-issues)
- [Platform-Specific Issues](#platform-specific-issues)

---

## Setup Issues

### ❌ Error: `Property 'crypto' doesn't exist`

**Problem**: Trying to use `send()` function from React Native client.

**Cause**: The `send()` function uses Web Crypto API (`crypto.subtle`) for JWT signing, which is not available