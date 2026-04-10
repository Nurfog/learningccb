use jsonwebtoken::jwk::{JwkSet, Jwk, CommonParameters, RSAKeyParameters, AlgorithmParameters};
use serde_json::json;
use std::env;

pub fn get_lti_private_key() -> jsonwebtoken::EncodingKey {
    let key_str = env::var("LTI_PRIVATE_KEY").unwrap_or_else(|_| {
        let dev_key_path = "services/lms-service/dev_keys/lti_private.pem";
        std::fs::read_to_string(dev_key_path).unwrap_or_else(|_| {
            // Devolver una clave ficticia o manejar el error de forma adecuada en producción
            // Por ahora, devolveremos una cadena que probablemente fallará al decodificarse si se utiliza,
            // pero permite que el servicio se inicie si no se utiliza LTI.
            tracing::warn!("Clave privada LTI no encontrada en {} y LTI_PRIVATE_KEY no está establecida.", dev_key_path);
            String::new()
        })
    });
    
    if key_str.is_empty() {
        // Manejar el caso de clave vacía; tal vez devolver un error especializado o una clave ficticia
        // que falle más tarde. jsonwebtoken::EncodingKey::from_rsa_pem suele esperar un PEM válido.
        // Utilizaremos un PEM ficticio con apariencia válida pero inútil si está vacío para evitar pánico al inicio,
        // pero fallará en el uso real de LTI.
        return jsonwebtoken::EncodingKey::from_rsa_pem(b"-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA7f...dummy...\n-----END RSA PRIVATE KEY-----").expect("Dummy key failed");
    }

    jsonwebtoken::EncodingKey::from_rsa_pem(key_str.as_bytes()).expect("Formato de clave privada LTI inválido")
}

pub fn get_lti_jwks() -> JwkSet {
    let n = env::var("LTI_JWK_N").unwrap_or_else(|_| {
        "weIdo6QklIJW77oEAd0NvX_L1e6mFRpHbSrhWjEJTfQDzLdNV84zPfu-rP-IJdWlvrtO2F_dHHah0ilNRZCaAwPXNqS6L57OrYJjxeDXKWnnfaVw4uUT1aDGFcXQ55Bbf05-N28aj26NEXh9WQVqO6L8XRrleRUgJtb8MBAWovxKi3CBJ_lFVYe31cPeAOCaEF_xzeMVEmJt3fbSewsUIrB7jD8F3YOcu8h_QGAc9tn9uxMfBJv2XZoGHCtMQUGG07iZtoSKBYGrWf5rBc7PsCF_VuQzlO9cf13jgQ2rcfcU3LwC_gp4A9RYnv_ymaHELz0kALKBtBxj1XU7QdLrsw".to_string() 
    });

    let jwk = Jwk {
        common: CommonParameters {
            public_key_use: Some(jsonwebtoken::jwk::PublicKeyUse::Signature),
            key_operations: None,
            key_algorithm: Some(jsonwebtoken::jwk::KeyAlgorithm::RS256),
            key_id: Some("openccb-lti-key-1".to_string()),
            x509_url: None,
            x509_chain: None,
            x509_sha1_fingerprint: None,
            x509_sha256_fingerprint: None,
        },
        algorithm: AlgorithmParameters::RSA(RSAKeyParameters {
            key_type: jsonwebtoken::jwk::RSAKeyType::RSA,
            n,
            e: "AQAB".to_string(),
        }),
    };

    JwkSet { keys: vec![jwk] }
}

pub async fn lti_jwks_handler() -> axum::Json<serde_json::Value> {
    let jwks = get_lti_jwks();
    axum::Json(json!(jwks))
}
