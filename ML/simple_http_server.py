from http.server import SimpleHTTPRequestHandler, HTTPServer
import os

PORT = 8080
BASE_DIR = os.path.join(os.getcwd(), "data")


class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        super().end_headers()


os.chdir(BASE_DIR)

httpd = HTTPServer(("localhost", PORT), CORSRequestHandler)
print(f"🚀 Serving images with CORS at http://localhost:{PORT}")
print(f"📂 Root: {BASE_DIR}")

httpd.serve_forever()
