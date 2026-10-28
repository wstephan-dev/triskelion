# Triskelion

Suivi du Triskelion des Argonautes pour **Aeon Trespass: Odyssey**, pensé pour téléphone et tablette.

Les 4 Argonautes ont chacun un nom, une couleur de plateau, un portrait et leurs trois valeurs de 0 à 9. Le cadran reprend la disposition et les couleurs du Triskelion du jeu :

| Valeur | Lettre | Couleur | Position |
|---|---|---|---|
| Rage | Ω | rouge | haut gauche |
| Fate | Ψ | bleu | haut droite |
| Danger | Λ | vert | bas |

## Utilisation

Disposition 2×2 fixe, sans défilement (testée aux formats iPad Air et OnePlus 8T, en portrait comme en paysage).

- **Ajuster une valeur** : chaque branche du triskèle est coupée en deux grandes zones tactiles. Toucher à droite du chiffre (**+**) ajoute 1, à gauche (**−**) retire 1.
- **Nom (bandeau coloré)** : changer le nom, la couleur du plateau et le portrait.
- **Portrait** : « Choisir un portrait » ouvre la galerie ou l'appareil photo. On peut prendre en photo la carte portrait de l'Argonaute. L'image est réduite automatiquement (environ 30 Ko).
- **↺ sur une carte** : remet cet Argonaute à 0. **Fin du combat** : remet tout le monde à 0.
- **Écran actif** : empêche la mise en veille pendant la partie.
- **Mort** : dans la fiche de l'Argonaute, « † Déclarer mort ». La carte passe en grisé avec un bandeau « † Mort † », et son cadran est verrouillé. « Ramener à la vie » le réactive en conservant ses valeurs du Triskelion.

### Au-delà de 9 (règles)

- **Danger** : peut dépasser 9 temporairement. La carte affiche la vraie valeur (ex. 12) et rappelle de résoudre la pioche Trauma/Obole à cette valeur. Le tableau du Danger massif est rappelé à 14+, 18+ et 21+. Le centre du cadran devient un bouton **« Résolu → 9 »** qui ramène le Danger à 9.
- **Fate** : reste à 9 et rappelle de piocher une carte Moiros (une 2ᵉ dans le même combat = mort).
- **Rage** : reste à 9 et rappelle que le Titan meurt à la fin de l'action en cours.
- Hors combat, dépasser 9 tue l'Argonaute, et c'est rappelé à chaque fois.

Les valeurs et portraits sont enregistrés dans l'appareil à chaque modification. Ils restent si l'écran se verrouille, si l'onglet est fermé ou si l'appareil redémarre.

## Lancer en local

Aucune dépendance ni compilation : ce sont des fichiers statiques.

```sh
python3 -m http.server 8765
# puis ouvrir http://localhost:8765
```

Pour y accéder depuis un téléphone sur le même Wi-Fi : `python3 -m http.server 8765 --bind 0.0.0.0`, puis ouvrir `http://<IP-du-PC>:8765`.

## Installer sur l'écran d'accueil

Héberger le dossier en HTTPS (GitHub Pages, Netlify, Cloudflare Pages…), puis dans le navigateur du téléphone :
- iOS (Safari) : Partager → « Sur l'écran d'accueil »
- Android (Chrome) : menu ⋮ → « Installer l'application »

En HTTPS, l'app fonctionne ensuite hors connexion.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page et fiches d'édition |
| `styles.css` | Apparence |
| `app.js` | Logique, rendu du triskèle, sauvegarde |
| `sw.js` | Cache hors connexion |
| `manifest.webmanifest`, `icon.svg` | Installation sur l'écran d'accueil |
