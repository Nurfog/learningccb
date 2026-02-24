#!/bin/bash

# Configuration
# Path is relative to the project root where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KEY_DIR="$SCRIPT_DIR/dev_keys"
mkdir -p "$KEY_DIR"

echo "🔐 Generando llaves de desarrollo para LTI..."

# 1. Private Key
openssl genrsa -out "$KEY_DIR/lti_private.pem" 2048

# 2. Public Key
openssl rsa -in "$KEY_DIR/lti_private.pem" -pubout -out "$KEY_DIR/lti_public.pem"

# 3. Extract Modulus (needed for JWKS 'n' parameter)
# Hex format
openssl rsa -in "$KEY_DIR/lti_private.pem" -noout -modulus | cut -d'=' -f2 > "$KEY_DIR/modulus_hex.txt"

# Base64URL format (standard for JWKS)
# We convert the hex modulus to binary and then to base64url
MODULUS_HEX=$(cat "$KEY_DIR/modulus_hex.txt")
python3 -c "import base64; print(base64.urlsafe_b64encode(bytes.fromhex('$MODULUS_HEX')).decode().rstrip('='))" > "$KEY_DIR/modulus_b64.txt"

echo "✅ Llaves generadas en $KEY_DIR"
echo "------------------------------------------------"
echo "Para producción, define las variables de entorno:"
echo "- LTI_PRIVATE_KEY: Contenido completo de lti_private.pem"
echo "- LTI_JWK_N: Contenido de modulus_b64.txt"
echo "------------------------------------------------"
