"""
!pip install cryptography
"""
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import base64

private_key = ec.generate_private_key(ec.SECP256R1())
public_key = private_key.public_key()

private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)
private_string = private_pem.decode()
private_string = private_string.replace("\n", "")
private_string = private_string.replace("-----BEGIN PRIVATE KEY-----", "")
private_string = private_string.replace("-----END PRIVATE KEY-----", "")
print(f'VAPID_PRIVATE_KEY = "{private_string}"')

public_bytes = public_key.public_bytes(
    encoding=serialization.Encoding.X962,
    format=serialization.PublicFormat.UncompressedPoint
)
public_key_b64 = base64.urlsafe_b64encode(public_bytes).decode('utf-8')
print(f'VAPID_PUBLIC_KEY = "{public_key_b64}"')
