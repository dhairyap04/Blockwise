from flask import Flask, jsonify, request
from flask_cors import CORS
import json, os
from dotenv import load_dotenv
import requests

app = Flask(__name__)
CORS(app)

load_dotenv()
HF_API_KEY = os.getenv("HF_API_KEY")

# Add secure logging for API key
if HF_API_KEY:
    print(f"Hugging Face API Key Loaded: {HF_API_KEY[:4]}...hidden")
else:
    print("Hugging Face API Key is missing!")

@app.route("/")
def index():
    return "Flask backend in running!"

@app.route("/api/buildings")
def get_buildings():
    try:
        # Fetch data from the provided API endpoint
        response = requests.get("https://data.calgary.ca/resource/uj4k-cdzk.json")
        response.raise_for_status()  # Raise an error for bad status codes

        # Parse the JSON response
        buildings = response.json()
        return jsonify(buildings)
    except requests.RequestException as e:
        print("Error fetching building data:", e)
        return jsonify({"error": "Failed to fetch building data"}), 500

@app.route("/api/query", methods=["POST"])
def handle_query():
    data = request.json
    print("Incoming Query:", data)

    user_input = data.get("query", "")

    # Refine the prompt to ensure valid JSON output
    prompt = f"""
    Extract a filter from the following query: "{user_input}".
    Return a JSON object with:
    - "attribute": the field to filter on (e.g., asset_type, location_detail).
    - "operator": the comparison operator (e.g., =, >, <).
    - "value": the value to filter by (string or number).

    Example input:
    Show all buildings with asset_type as 'HISTORIC BUILDING'

    Example output:
    {{"attribute": "asset_type", "operator": "=", "value": "HISTORIC BUILDING"}}

    Only output valid JSON. Do not include any explanation or extra text.
    """

    headers = {
        "Authorization": f"Bearer {HF_API_KEY}"
    }

    try:
        # Fetch building data dynamically
        response = requests.get("https://data.calgary.ca/resource/uj4k-cdzk.json")
        response.raise_for_status()
        buildings = response.json()
    except requests.RequestException as e:
        print("Error fetching building data:", e)
        return jsonify({"error": "Failed to fetch building data"}), 500

    # Proceed with query handling
    print("Received query:", user_input)
    print("Generated prompt for LLM:", prompt)

    # Parse the query in the format: "attribute operator value"
    try:
        # Example: "asset_type = HISTORIC BUILDING"
        parts = user_input.split(" ", 2)
        if len(parts) != 3:
            raise ValueError("Invalid query format")

        attribute, operator, value = parts
        attribute = attribute.strip().replace(" ", "_")  # Convert to dataset field format
        value = value.strip().strip("'")

        filters = {"attribute": attribute, "operator": operator, "value": value}
        print("Extracted Filters:", filters)

        # Safely evaluate the filter condition without using eval
        filtered = []
        for b in buildings:
            val = b.get(filters["attribute"])
            if val is not None:
                try:
                    if filters["operator"] == "=":
                        if str(val) == filters["value"]:
                            filtered.append(b)
                    elif filters["operator"] == "<":
                        if float(val) < float(filters["value"]):
                            filtered.append(b)
                    elif filters["operator"] == ">":
                        if float(val) > float(filters["value"]):
                            filtered.append(b)
                except ValueError as e:
                    print("Error evaluating filter:", e)
                    continue

        print("Filtered Buildings:", filtered)
        return jsonify(filtered if isinstance(filtered, list) else [])
    except Exception as e:
        print("Error parsing query:", e)
        return jsonify({"error": "Failed to parse query. Please use the format: '<attribute> <operator> <value>'"}), 400

if __name__ == "__main__":
    app.run(debug=True)
