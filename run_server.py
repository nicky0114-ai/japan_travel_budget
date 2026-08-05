import http.server
import socketserver
import socket
import sys

PORT = 8000

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # 不需要真的連通，只是為了取得本機在區域網路中的 IP
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

class MyHandler(http.server.SimpleHTTPRequestHandler):
    # 避免快取影響開發調試
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

# 使用 Threading or standard server
socketserver.TCPServer.allow_reuse_address = True

try:
    with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
        ip = get_ip()
        print("=======================================================")
        print(" 🇯🇵 日本旅遊可愛記帳趣 - 本地 Wi-Fi 分享伺服器已啟動！ 🐕")
        print("=======================================================")
        print(" 🌸 請讓所有手機連線到與這台電腦「同一個 Wi-Fi」熱點")
        print(" 📱 然後在手機瀏覽器（Safari 或 Chrome）輸入以下網址即可記帳：")
        print("\n   👉 http://{}:{}".format(ip, PORT))
        print("\n (電腦自己也可以開瀏覽器輸入 http://localhost:{})".format(PORT))
        print("=======================================================")
        print(" 提示：按 [Ctrl + C] 可以關閉伺服器。祝您和家人日本之旅愉快！✈️")
        
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\n👋 伺服器已關閉。祝旅途愉快！🌸")
    sys.exit(0)
except Exception as e:
    print("\n❌ 啟動失敗：", e)
    print("請確認 Port {} 沒有被其他程式佔用。".format(PORT))
