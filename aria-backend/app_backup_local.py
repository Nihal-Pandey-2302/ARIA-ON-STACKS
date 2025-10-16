# app.py (Final Version - Fixed)
from flask import Flask, request, jsonify
from dotenv import load_dotenv
import os
import google.generativeai as genai
import requests
import json
from flask_cors import CORS
import subprocess
from pyzbar.pyzbar import decode
from PIL import Image
import cv2
import numpy as np
import pypdf
import io

load_dotenv()
app = Flask(__name__)
CORS(app)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
PINATA_API_KEY = os.getenv("PINATA_API_KEY")
PINATA_SECRET_API_KEY = os.getenv("PINATA_SECRET_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-pro')

def upload_to_ipfs(json_data: dict) -> str:
    if not PINATA_API_KEY or not PINATA_SECRET_API_KEY:
        raise Exception("Pinata API keys not set in .env")
    headers = { "Content-Type": "application/json", "pinata_api_key": PINATA_API_KEY, "pinata_secret_api_key": PINATA_SECRET_API_KEY }
    body = { "pinataContent": json_data, "pinataMetadata": { "name": json_data.get("name", "rwa_metadata.json") } }
    response = requests.post("https://api.pinata.cloud/pinning/pinJSONToIPFS", json=body, headers=headers)
    response.raise_for_status()
    ipfs_hash = response.json().get("IpfsHash")
    if not ipfs_hash: raise Exception("Failed to get IPFS hash from Pinata response")
    return f"https://gateway.pinata.cloud/ipfs/{ipfs_hash}"

def find_and_decode_qr(document_bytes, mime_type):
    try:
        if "pdf" in mime_type:
            pdf_file = pypdf.PdfReader(io.BytesIO(document_bytes))
            for page in pdf_file.pages:
                for image_file_object in page.images:
                    img = Image.open(io.BytesIO(image_file_object.data))
                    decoded_objects = decode(img)
                    if decoded_objects: return decoded_objects[0].data.decode("utf-8")
        else:
            img_array = np.frombuffer(document_bytes, np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            decoded_objects = decode(img)
            if decoded_objects: return decoded_objects[0].data.decode("utf-8")
        return None
    except Exception as e:
        print(f"QR Code Scan Warning: {e}")
        return None

@app.route('/analyze_and_mint', methods=['POST'])
def analyze_and_mint():
    if 'document' not in request.files: return jsonify({"error": "No document part"}), 400
    document_file = request.files['document']
    recipient_address = request.form.get("owner_address")
    if document_file.filename == '': return jsonify({"error": "No selected document"}), 400
    if not recipient_address: return jsonify({"error": "No owner_address provided"}), 400
    
    try:
        document_bytes = document_file.read()
        prompt = "Analyze this document. If it is an invoice, extract the invoice total, currency, and date. Also, determine if it looks authentic. Output ONLY a valid JSON object with fields: 'is_invoice', 'total', 'currency', 'date', 'authenticity_score', 'verification_summary'."
        contents = [{"mime_type": document_file.content_type, "data": document_bytes}, prompt]
        response = model.generate_content(contents)
        ai_report_json = json.loads(response.text.strip().replace("```json", "").replace("```", ""))
        
        qr_content = find_and_decode_qr(document_bytes, document_file.content_type)
        verification_method = "AI Analysis Only"
        if qr_content: verification_method = "✅ QR Code Confirmed"
        ai_report_json["verification_method"] = verification_method
        
        nft_metadata = { 
            "name": f"AI Verified RWA: {document_file.filename}", 
            "description": "An RWA verified by A.R.I.A.", 
            "image": "https://gateway.pinata.cloud/ipfs/Qma5Fpw3Y2jL6vAacgEAA418f2f2KJEaJkkhq2tYmS3a1V", 
            "attributes": [{"trait_type": "Verification", "value": verification_method}], 
            "properties": {"ai_report": ai_report_json} 
        }
        ipfs_url = upload_to_ipfs(nft_metadata)
        ipfs_hash = ipfs_url.split('/')[-1]

        NODE_EXECUTABLE_PATH = "/home/nihal/.nvm/versions/node/v22.18.0/bin/node"
        script_path = os.path.join(os.path.dirname(__file__), 'mint_helper.cjs')
        backend_dir = os.path.dirname(__file__)

        app.logger.info(f"Executing minting script for recipient: {recipient_address}, IPFS: {ipfs_hash}")
        
        result = subprocess.run(
            [NODE_EXECUTABLE_PATH, script_path, recipient_address, ipfs_hash],
            capture_output=True, 
            text=True, 
            env=os.environ, 
            cwd=backend_dir
        )

        # Log the raw output for debugging
        app.logger.info(f"Mint script returncode: {result.returncode}")
        app.logger.info(f"Mint script stdout: {result.stdout}")
        app.logger.info(f"Mint script stderr: {result.stderr}")

        if result.returncode != 0:
            error_message = f"Minting script failed with return code {result.returncode}"
            app.logger.error(error_message)
            
            # Try to parse error from stdout first, then stderr
            try:
                error_data = json.loads(result.stdout.strip())
                return jsonify({"error": "Minting failed", "details": error_data.get('error', 'Unknown error')}), 500
            except:
                return jsonify({"error": "Minting script failed", "details": result.stderr or result.stdout}), 500

        # Parse the successful result from stdout
        try:
            # The stdout might have multiple lines due to dotenv messages
            # Find the last line that looks like JSON
            stdout_lines = result.stdout.strip().split('\n')
            json_line = None
            
            for line in reversed(stdout_lines):
                if line.strip().startswith('{'):
                    json_line = line.strip()
                    break
            
            if not json_line:
                raise ValueError("No JSON output found in stdout")
            
            mint_result = json.loads(json_line)
            
            if 'error' in mint_result:
                raise Exception(f"Minting script returned error: {mint_result['error']}")
            
            tx_id = mint_result.get('txId')
            if not tx_id:
                raise Exception("No txId in minting result")
            
            app.logger.info(f"Minting successful! TxID: {tx_id}")
            
            return jsonify({ 
                "success": True, 
                "txId": tx_id, 
                "ai_report_display": ai_report_json, 
                "ipfs_link": ipfs_url 
            }), 200
            
        except json.JSONDecodeError as e:
            app.logger.error(f"Failed to parse mint script output as JSON: {e}")
            app.logger.error(f"Raw stdout: {result.stdout}")
            return jsonify({"error": "Invalid response from minting script", "details": str(e)}), 500

    except Exception as e:
        app.logger.error(f"Error in /analyze_and_mint: {e}", exc_info=True)
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)