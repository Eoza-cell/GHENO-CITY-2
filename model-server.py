import sys
import os
import json
import re
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

print("[Python Model Server] Pre-loading Transformers model into memory...")
from transformers import pipeline

model_name = "Qwen/Qwen2.5-0.5B-Instruct"
try:
    pipe = pipeline("text-generation", model=model_name, device_map="cpu")
    print("[Python Model Server] Model loaded successfully into RAM!")
except Exception as e:
    print("[Python Model Server] Error loading model:", e)
    pipe = None

class ModelHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8')

        try:
            req = json.loads(post_data)
            user_prompt = req.get("prompt", "Je tire mon épée.")

            action_text = user_prompt.replace('ACTION:', '').strip()
            if "DERNIÈRE ACTION DE" in user_prompt:
                m = re.search(r'DERNIÈRE ACTION DE\s+[^:\n]+:\s*["\']?([^"\n\r\]]+)["\']?', user_prompt, re.IGNORECASE)
                if m:
                    action_text = m.group(1).strip()

            player_name = "l'Héritier"
            name_match = re.search(r'PERSONNAGE ACTIF\s*:\s*([^\n|]+)', user_prompt, re.IGNORECASE) or re.search(r'DERNIÈRE ACTION DE\s+([A-Za-z0-9\s\-_.]+)\s*:', user_prompt, re.IGNORECASE)
            if name_match:
                player_name = name_match.group(1).strip().split(' ')[0]

            location = "Empire Impérial d'Elion"
            loc_match = re.search(r'Lieu\s*:\s*([^\n|()]+)', user_prompt, re.IGNORECASE) or re.search(r'ROYAUME ACTUEL\s*:\s*([^\n|()]+)', user_prompt, re.IGNORECASE)
            if loc_match:
                location = loc_match.group(1).strip()

            response_text = None
            if pipe is not None:
                messages = [
                    {"role": "system", "content": "Tu es un écrivain de mangas de fantasy Shonen et le Meneur de Jeu d'After the Rebirth (ATR). Rédige la suite du récit de l'aventure fictive du héros en français, de manière vivante, fluide et spectaculaire."},
                    {"role": "user", "content": f"Le héros {player_name} se trouve à {location} et accomplit l'action : « {action_text} ». Rédige la suite du récit de combat et de son aventure."}
                ]
                t0 = time.time()
                res = pipe(messages, max_new_tokens=220, do_sample=True, temperature=0.75, top_p=0.9)
                t1 = time.time()
                print(f"[Python Model Server] Generated neural response in {t1 - t0:.2f}s")
                if res and len(res) > 0 and 'generated_text' in res[0]:
                    raw = res[0]['generated_text']
                    if isinstance(raw, list):
                        response_text = raw[-1]['content']

            if not response_text or len(response_text.strip()) < 10 or "ne peux pas vous aider" in response_text or "désolé" in response_text.lower():
                import random
                xp = random.randint(120, 250)
                gold = random.randint(150, 280)
                lower_act = action_text.lower()
                is_combat = any(k in lower_act for k in ['attaque', 'frappe', 'épée', 'lame', 'sort', 'magie', 'monstre', 'combat', 'frapper', 'coup'])
                is_social = any(k in lower_act for k in ['parle', 'demande', 'question', 'dialogue', 'cherche', 'salue', 'dis', 'répond'])

                if is_combat:
                    response_text = f"L'atmosphère d'ATR se tend brusquement alors que {player_name} passe à l'offensive ! Lorsque tu accomplis « {action_text} », ton énergie spirituelle se déchaîne, traçant un arc de lumière d'éther pur au milieu de la pénombre.\n\nLe choc résonne à travers le secteur avec un fracas assourdissant. Ton adversaire est ébranlé de plein fouet, incapable de parer la totalité de la force déployée par ton essence d'Héritier. Les témoins et gardes locaux retiennent leur souffle devant une telle démonstration de Battle IQ et de maîtrise tactique.\n\nLa menace est repoussée, affirmant ton autorité dans la zone."
                elif is_social:
                    response_text = f"Dans l'agitation d'After the Rebirth, {player_name} s'adresse directement à ses interlocuteurs. Lorsque tu effectues « {action_text} », ta voix résonne avec une assurance naturelle qui capte immédiatement l'attention des PNJ environnants.\n\nLes PNJ locaux s'arrêtent, écoutant attentivement tes paroles. Impressionnés par ton calme et la marque de ton rang, ils s'inclinent légèrement et te révèlent des informations précieuses concernant la région.\n\nCes renseignements te permettent d'orienter tes pas avec une clarté optimale."
                else:
                    response_text = f"Sous le ciel d'After the Rebirth, {player_name} poursuit sa progression. En accomplissant « {action_text} », tes pas résonnent fermement sur le sol, traçant un chemin net à travers le territoire.\n\nL'environnement s'adapte à ta présence, révélant de nouveaux détails sur la géographie et les mystères environnants.\n\nTu amènes ton personnage à la position souhaitée, prêt pour la suite de ton destin."

            # Append reward brackets and image prompt
            import random
            xp = random.randint(120, 250)
            gold = random.randint(150, 280)
            full_response = f"{response_text.strip()}\n\n[{player_name}: EXP +{xp}]\n[{player_name}: GOLD +{gold}]\n[IMAGE: epic anime digital painting of {player_name} executing {action_text} in {location}, glowing magic effects, high detail fantasy art]"

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"choices": [{"message": {"content": full_response}}]}).encode('utf-8'))
        except Exception as err:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(err)}).encode('utf-8'))

    def log_message(self, format, *args):
        return

def run_server(port=8088):
    server_address = ('', port)
    httpd = HTTPServer(server_address, ModelHandler)
    print(f"[Python Model Server] Running on http://127.0.0.1:{port} ...")
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()
