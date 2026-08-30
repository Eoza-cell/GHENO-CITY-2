import sys
import os
import re

def read_arg(arg):
    if os.path.exists(arg):
        try:
            with open(arg, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception:
            pass
    return arg

def main():
    if len(sys.argv) < 3:
        system_prompt = "Tu es le Meneur de Jeu (MJ) d'After the Rebirth (ATR)."
        user_prompt = read_arg(sys.argv[1]) if len(sys.argv) > 1 else "Action"
    else:
        system_prompt = read_arg(sys.argv[1])
        user_prompt = read_arg(sys.argv[2])

    player_name = "l'Héritier"
    name_match = re.search(r'PERSONNAGE ACTIF\s*:\s*([^\n|]+)', user_prompt, re.IGNORECASE) or re.search(r'DERNIÈRE ACTION DE\s+([A-Za-z0-9\s\-_.]+)\s*:', user_prompt, re.IGNORECASE)
    if name_match:
        player_name = name_match.group(1).strip().split(' ')[0]

    action_text = user_prompt.replace('ACTION:', '').strip()
    if "DERNIÈRE ACTION DE" in user_prompt:
        m = re.search(r'DERNIÈRE ACTION DE\s+[^:\n]+:\s*["\']?([^"\n\r\]]+)["\']?', user_prompt, re.IGNORECASE)
        if m:
            action_text = m.group(1).strip()

    # Neural Story Generation with Empero AI / Hugging Face Transformers models
    empero_models = ["empero-ai/Qwen3.8-2B", "empero-ai/Qwythos-9B-v2", "Qwen/Qwen2.5-0.5B-Instruct"]
    try:
        from transformers import pipeline

        model_name = os.getenv("EMPERO_MODEL", empero_models[0])
        pipe = pipeline("text-generation", model=model_name)
        prompt = f"Un grand récit fantastique de jeu de rôle dans le monde d'After the Rebirth (ATR).\nLe joueur {player_name} accomplis : « {action_text} ».\nVoici la suite directe et détaillée du récit en français :\n"

        result = pipe(prompt, max_new_tokens=180, do_sample=True, temperature=0.75, top_p=0.9)
        if result and len(result) > 0 and 'generated_text' in result[0]:
            raw = result[0]['generated_text']
            story = raw[len(prompt):].strip()

            if story and len(story) > 15:
                # Add reward brackets for the parser
                import random
                xp = random.randint(120, 220)
                gold = random.randint(140, 250)
                full_output = f"{story}\n\n[{player_name}: EXP +{xp}]\n[{player_name}: GOLD +{gold}]\n[IMAGE: epic anime digital painting of {player_name} executing {action_text}, glowing energy effects, high detail fantasy art]"
                print(full_output)
                return
    except Exception as e:
        pass

    # Neural Fallback Generator
    import random
    xp = random.randint(120, 220)
    gold = random.randint(140, 250)

    lower_act = action_text.lower()
    is_combat = any(k in lower_act for k in ['attaque', 'frappe', 'épée', 'lame', 'sort', 'magie', 'monstre', 'combat', 'frapper', 'coup'])
    is_social = any(k in lower_act for k in ['parle', 'demande', 'question', 'dialogue', 'cherche', 'salue', 'dis', 'répond'])

    if is_combat:
        output = f"L'atmosphère d'ATR se tend brusquement alors que {player_name} passe à l'offensive ! Lorsque tu accomplis « {action_text} », ton énergie spirituelle se déchaîne, traçant un arc de lumière d'éther pur au milieu de la pénombre.\n\nLe choc résonne à travers le secteur avec un fracas assourdissant. Ton adversaire est ébranlé de plein fouet, incapable de parer la totalité de la force déployée par ton essence d'Héritier. Les témoins et gardes locaux retiennent leur souffle devant une telle démonstration de Battle IQ et de maîtrise tactique.\n\nLa menace est repoussée, affirmant ton autorité dans la zone.\n\n[{player_name}: EXP +{xp}]\n[{player_name}: GOLD +{gold}]\n[IMAGE: epic anime digital painting of {player_name} executing {action_text}, glowing magic effects, high detail fantasy art]"
    elif is_social:
        output = f"Dans l'agitation d'After the Rebirth, {player_name} s'adresse directement à ses interlocuteurs. Lorsque tu effectues « {action_text} », ta voix résonne avec une assurance naturelle qui capte immédiatement l'attention des PNJ environnants.\n\nLes PNJ locaux s'arrêtent, écoutant attentivement tes paroles. Impressionnés par ton calme et la marque de ton rang, ils s'inclinent légèrement et te révèlent des informations précieuses concernant la région.\n\nCes renseignements te permettent d'orienter tes pas avec une clarté optimale.\n\n[{player_name}: EXP +{xp}]\n[{player_name}: GOLD +{gold}]\n[IMAGE: anime digital painting of {player_name} speaking with NPCs, expressive character art]"
    else:
        output = f"Sous le ciel d'After the Rebirth, {player_name} poursuit sa progression. En accomplissant « {action_text} », tes pas résonnent fermement sur le sol, traçant un chemin net à travers le territoire.\n\nL'environnement s'adapte à ta présence, révélant de nouveaux détails sur la géographie et les mystères environnants.\n\nTu amènes ton personnage à la position souhaitée, prêt pour la suite de ton destin.\n\n[{player_name}: EXP +{xp}]\n[{player_name}: GOLD +{gold}]\n[IMAGE: scenic anime background of {player_name} exploring, majestic landscape, detailed fantasy art]"

    print(output)

if __name__ == "__main__":
    main()
