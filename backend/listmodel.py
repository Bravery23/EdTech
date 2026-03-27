import google.generativeai as genai

genai.configure(api_key="AIzaSyAYAR5dY6tuRqmZDNNKcErlFotgC6uokok")

try:
    for m in genai.list_models():
        if 'embedContent' in m.supported_generation_methods:
            print(f"Model khả dụng: {m.name}")
except Exception as e:
    print(f"Lỗi truy cập API: {e}")