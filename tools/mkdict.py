"""Génère les dictionnaires EN/ES de lib/i18n.ts depuis la table de traduction."""
import re

# (clé FR, EN, ES)
T = [
 ("+{amt} ajoutés.", "+{amt} added.", "+{amt} añadidos."),
 ("+{n} autre résultat après celui-ci", "+{n} more result after this one", "+{n} resultado más después de este"),
 ("+{n} autres résultats après celui-ci", "+{n} more results after this one", "+{n} resultados más después de este"),
 (", appuie sur", ", press", ", pulsa"),
 ("-{amt} retirés.", "-{amt} withdrawn.", "-{amt} retirados."),
 ("1. Choisis un jeu", "1. Choose a game", "1. Elige un juego"),
 ("2. Lis le graphique", "2. Read the chart", "2. Lee el gráfico"),
 ("3 jeux, 100 % hasard", "3 games, 100% chance", "3 juegos, 100 % azar"),
 ("3. Choisis une durée", "3. Choose a duration", "3. Elige una duración"),
 ("4. Choisis ta mise", "4. Choose your bet", "4. Elige tu apuesta"),
 ("5. Prédis la direction", "5. Predict the direction", "5. Predice la dirección"),
 ("Accueil Trader", "Trade home", "Inicio"),
 ("Actualiser", "Refresh", "Actualizar"),
 ("Adresse e-mail invalide.", "Invalid email address.", "Dirección de correo inválida."),
 ("Ajouter", "Add", "Añadir"),
 ("Ajouter au solde", "Add to balance", "Añadir al saldo"),
 ("Allemagne", "Germany", "Alemania"),
 ("Annulation impossible pour le moment.", "Can't cancel right now.", "No se puede cancelar en este momento."),
 ("Annuler", "Cancel", "Cancelar"),
 ("Annuler la mise programmée à {hm} (remboursée)", "Cancel the bet scheduled at {hm} (refunded)", "Cancelar la apuesta programada a las {hm} (reembolsada)"),
 ("Apprends sans risque", "Learn with no risk", "Aprende sin riesgo"),
 ("Appuie sur « Préparer ma mise » : tout est déjà rempli.", "Tap “Prepare my bet”: everything is already filled in.", "Toca «Preparar mi apuesta»: todo ya está completo."),
 ("Arrivée", "Finish", "Llegada"),
 ("Aucun jeu n'est disponible pour le moment.", "No game is available right now.", "Ningún juego está disponible en este momento."),
 ("Aucun trade", "No trades", "Ninguna operación"),
 ("Aucun trade en cours", "No open trades", "Ninguna operación en curso"),
 ("Augmenter la mise", "Increase bet", "Aumentar la apuesta"),
 ("Aujourd'hui", "Today", "Hoy"),
 ("Autre", "Other", "Otra"),
 ("Autre zone euro", "Other euro area", "Otra zona euro"),
 ("Baisse", "Down", "Baja"),
 ("Baisse : je prédis que le prix va descendre", "Down: I predict the price will go down", "Baja: predigo que el precio va a bajar"),
 ("Baisse ▼", "Down ▼", "Baja ▼"),
 ("Belgique", "Belgium", "Bélgica"),
 ("Bon retour !", "Welcome back!", "¡Hola de nuevo!"),
 ("Bougie verte ▲ : le prix a monté. Bougie rouge ▼ : il a baissé.", "Green candle ▲: the price went up. Red candle ▼: it went down.", "Vela verde ▲: el precio subió. Vela roja ▼: bajó."),
 ("Burkina Faso", "Burkina Faso", "Burkina Faso"),
 ("Bénin", "Benin", "Benín"),
 ("C'est le moment : appuie sur", "Now is the time: press", "Es el momento: pulsa"),
 ("C'est parti !", "Let's go!", "¡Vamos!"),
 ("Cedi", "Cedi", "Cedi"),
 ("Chargement de TradeFacile…", "Loading TradeFacile…", "Cargando TradeFacile…"),
 ("Chargement des signaux...", "Loading signals...", "Cargando señales..."),
 ("Chargement du graphique...", "Loading chart...", "Cargando gráfico..."),
 ("Chargement...", "Loading...", "Cargando..."),
 ("Choisir l'heure", "Choose the time", "Elegir la hora"),
 ("Choisir l'heure de la mise", "Choose the bet time", "Elegir la hora de la apuesta"),
 ("Choisir la durée", "Choose the duration", "Elegir la duración"),
 ("Choisir le jeu", "Choose the game", "Elegir el juego"),
 ("Choisir un jeu", "Choose a game", "Elegir un juego"),
 ("Choisir…", "Choose…", "Elegir…"),
 ("Choisis ta mise, puis attends la fin du décompte.", "Choose your bet, then wait for the countdown to end.", "Elige tu apuesta y espera al final de la cuenta atrás."),
 ("Choisis un mot de passe", "Choose a password", "Elige una contraseña"),
 ("Choisis une heure à venir dans la liste.", "Choose an upcoming time from the list.", "Elige una hora futura de la lista."),
 ("Choisissez Hausse (ça monte) ou Baisse (ça descend).", "Choose Up (it goes up) or Down (it goes down).", "Elige Sube (sube) o Baja (baja)."),
 ("Choisissez des jeux proposés dans la liste.", "Choose games from the list.", "Elige juegos de la lista."),
 ("Choisissez fr, en ou es.", "Choose fr, en or es.", "Elige fr, en o es."),
 ("Choisissez un intervalle : 1m, 5m ou 15m.", "Choose an interval: 1m, 5m or 15m.", "Elige un intervalo: 1m, 5m o 15m."),
 ("Choisissez un jeu proposé dans la liste.", "Choose a game from the list.", "Elige un juego de la lista."),
 ("Choisissez un pays proposé dans la liste.", "Choose a country from the list.", "Elige un país de la lista."),
 ("Choisissez une devise proposée dans la liste.", "Choose a currency from the list.", "Elige una divisa de la lista."),
 ("Choisissez une durée : 3 s, 10 s, 30 s, 1 min ou 5 min.", "Choose a duration: 3s, 10s, 30s, 1min or 5min.", "Elige una duración: 3 s, 10 s, 30 s, 1 min o 5 min."),
 ("Choisissez une heure pile (ex : 14:35:00).", "Choose an exact time (e.g. 14:35:00).", "Elige una hora exacta (p. ej.: 14:35:00)."),
 ("Clôture impossible pour le moment.", "Can't settle right now.", "No se puede cerrar en este momento."),
 ("Combiné impossible pour le moment.", "Can't place a combo right now.", "No se puede hacer la combinada en este momento."),
 ("Combinés temporairement indisponibles.", "Combos temporarily unavailable.", "Combinadas no disponibles temporalmente."),
 ("Commencer", "Get started", "Empezar"),
 ("Comment ne pas louper le coup", "How not to miss the round", "Cómo no perderte la ronda"),
 ("Connecte-toi pour continuer à jouer.", "Log in to keep playing.", "Inicia sesión para seguir jugando."),
 ("Connectez-vous pour continuer.", "Log in to continue.", "Inicia sesión para continuar."),
 ("Connexion impossible pour le moment.", "Can't log in right now.", "No se puede iniciar sesión en este momento."),
 ("Connexion impossible.", "Can't log in.", "No se puede iniciar sesión."),
 ("Connexion…", "Logging in…", "Iniciando sesión…"),
 ("Cours temporairement indisponibles. Réessayez dans quelques secondes.", "Quotes temporarily unavailable. Try again in a few seconds.", "Cotizaciones no disponibles temporalmente. Inténtalo de nuevo en unos segundos."),
 ("Création…", "Creating…", "Creando…"),
 ("Crée ton compte", "Create your account", "Crea tu cuenta"),
 ("Crée ton compte, puis touche « Ajouter » dans ton profil pour recharger ton solde.", "Create your account, then tap “Add” in your profile to top up your balance.", "Crea tu cuenta y luego toca «Añadir» en tu perfil para recargar tu saldo."),
 ("Créer mon compte", "Create my account", "Crear mi cuenta"),
 ("Créer un compte", "Create an account", "Crear una cuenta"),
 ("Côte d'Ivoire", "Ivory Coast", "Costa de Marfil"),
 ("Dans", "In", "En"),
 ("Dans les 3 dernières secondes, appuie sur le bouton conseillé : ta mise partira toute seule à la seconde pile.", "In the last 3 seconds, press the suggested button: your bet will go off on its own at the exact second.", "En los últimos 3 segundos, pulsa el botón sugerido: tu apuesta se realizará sola en el segundo exacto."),
 ("Deux jambes identiques : ça ne compte pas double.", "Two identical legs: that doesn't count double.", "Dos partes idénticas: eso no cuenta doble."),
 ("Devise", "Currency", "Divisa"),
 ("Devise d'affichage", "Display currency", "Divisa de visualización"),
 ("Devise impossible pour le moment.", "Can't change currency right now.", "No se puede cambiar la divisa en este momento."),
 ("Devise mise à jour.", "Currency updated.", "Divisa actualizada."),
 ("Diminuer la mise", "Decrease bet", "Reducir la apuesta"),
 ("Direct ▸", "Live ▸", "En directo ▸"),
 ("Dollar américain", "US Dollar", "Dólar estadounidense"),
 ("Doucement : 20 combinés par minute maximum. Attendez quelques secondes.", "Slow down: 20 combos per minute maximum. Wait a few seconds.", "Despacio: 20 combinadas por minuto como máximo. Espera unos segundos."),
 ("Doucement : 20 prédictions par minute maximum. Attendez quelques secondes.", "Slow down: 20 predictions per minute maximum. Wait a few seconds.", "Despacio: 20 predicciones por minuto como máximo. Espera unos segundos."),
 ("Durée", "Duration", "Duración"),
 ("Durée ou départ", "Duration or start", "Duración o inicio"),
 ("Durée {dur}. Changer.", "Duration {dur}. Change.", "Duración {dur}. Cambiar."),
 ("Découvrir l'app en 3 écrans", "Discover the app in 3 screens", "Descubre la app en 3 pantallas"),
 ("Déjà un compte ?", "Already have an account?", "¿Ya tienes cuenta?"),
 ("Départ", "Start", "Inicio"),
 ("Départ dans", "Starts in", "Empieza en"),
 ("Départ dans {x}", "Starts in {x}", "Empieza en {x}"),
 ("Départ à {hm}, durée {dur}. Changer.", "Start at {hm}, duration {dur}. Change.", "Inicio a las {hm}, duración {dur}. Cambiar."),
 ("Dépôt impossible pour le moment.", "Can't top up right now.", "No se puede recargar en este momento."),
 ("E-mail", "Email", "Correo"),
 ("E-mail ou mot de passe incorrect.", "Incorrect email or password.", "Correo o contraseña incorrectos."),
 ("En cours", "Open", "En curso"),
 ("En cours ({n})", "Open ({n})", "En curso ({n})"),
 ("Entrez un montant de mise.", "Enter a bet amount.", "Introduce un importe de apuesta."),
 ("Espagne", "Spain", "España"),
 ("Euro", "Euro", "Euro"),
 ("Fermer", "Close", "Cerrar"),
 ("Filtrer l'historique", "Filter history", "Filtrar el historial"),
 ("Filtrer par jeu", "Filter by game", "Filtrar por juego"),
 ("Fin dans", "Ends in", "Termina en"),
 ("Fin dans {x}", "Ends in {x}", "Termina en {x}"),
 ("Fin {x}", "Ends {x}", "Termina {x}"),
 ("Fonds d'entraînement. Aucun paiement réel, jamais.", "Training funds. No real payment, ever.", "Fondos de entrenamiento. Ningún pago real, nunca."),
 ("Franc CFA (UEMOA)", "CFA Franc (WAEMU)", "Franco CFA (UEMOA)"),
 ("France", "France", "Francia"),
 ("Gagné +{amt}", "Won +{amt}", "Ganado +{amt}"),
 ("Gain potentiel", "Potential payout", "Ganancia potencial"),
 ("Ghana", "Ghana", "Ghana"),
 ("Graphique en bougies. Glisser pour défiler, pincer ou molette pour zoomer, double-toucher pour revenir au direct.", "Candlestick chart. Drag to scroll, pinch or wheel to zoom, double-tap to return to live.", "Gráfico de velas. Arrastra para desplazarte, pellizca o usa la rueda para zoom, toca dos veces para volver en directo."),
 ("Graphique temporairement indisponible.", "Chart temporarily unavailable.", "Gráfico no disponible temporalmente."),
 ("Guinée-Bissau", "Guinea-Bissau", "Guinea-Bisáu"),
 ("Hausse", "Up", "Sube"),
 ("Hausse : je prédis que le prix va monter", "Up: I predict the price will go up", "Sube: predigo que el precio va a subir"),
 ("Hausse et Baisse sur le même jeu : combiné perdu d'avance.", "Up and Down on the same game: combo lost in advance.", "Sube y Baja en el mismo juego: combinada perdida de antemano."),
 ("Hausse ▲", "Up ▲", "Sube ▲"),
 ("Hausse ▲ si ça monte, Baisse ▼ si ça descend. Tes prédictions en cours s'affichent ici : touche la pastille « N en cours » sur le graphique pour les suivre avec leur compte à rebours.", "Up ▲ if it goes up, Down ▼ if it goes down. Your open predictions appear here: tap the “N open” badge on the chart to follow them with their countdown.", "Sube ▲ si sube, Baja ▼ si baja. Tus predicciones en curso aparecen aquí: toca la insignia «N en curso» en el gráfico para seguirlas con su cuenta atrás."),
 ("Heure passée : choisis une autre heure.", "That time has passed: choose another time.", "Esa hora ya pasó: elige otra hora."),
 ("Heure passée : choisis une heure à venir.", "That time has passed: choose an upcoming time.", "Esa hora ya pasó: elige una hora futura."),
 ("Heure trop proche : choisis une heure plus tardive.", "Too soon: choose a later time.", "Demasiado pronto: elige una hora más tardía."),
 ("Heure trop proche : choisissez une heure plus tardive.", "Too soon: choose a later time.", "Demasiado pronto: elige una hora más tardía."),
 ("Heures proposées", "Suggested times", "Horas propuestas"),
 ("Hier", "Yesterday", "Ayer"),
 ("Historique", "History", "Historial"),
 ("Historique indisponible.", "History unavailable.", "Historial no disponible."),
 ("Historique temporairement indisponible.", "History temporarily unavailable.", "Historial no disponible temporalmente."),
 ("Hors ligne : reconnecte-toi pour voir les signaux.", "Offline: reconnect to see the signals.", "Sin conexión: vuelve a conectarte para ver las señales."),
 ("Hors ligne : reconnecte-toi, tes actions sont en pause.", "Offline: reconnect, your actions are paused.", "Sin conexión: vuelve a conectarte, tus acciones están en pausa."),
 ("Hors ligne : reconnectez-vous pour jouer.", "Offline: reconnect to play.", "Sin conexión: vuelve a conectarte para jugar."),
 ("Inscription impossible pour le moment.", "Can't sign up right now.", "No se puede crear la cuenta en este momento."),
 ("Inscription impossible.", "Can't sign up.", "No se puede crear la cuenta."),
 ("Investissement", "Investment", "Inversión"),
 ("Italie", "Italy", "Italia"),
 ("JEU", "GAME", "JUEGO"),
 ("Jeu : {name}. Changer de jeu.", "Game: {name}. Change game.", "Juego: {name}. Cambiar de juego."),
 ("Jeu changé : programmation annulée.", "Game changed: scheduling cancelled.", "Juego cambiado: programación cancelada."),
 ("La mise minimum est de {min}.", "The minimum bet is {min}.", "La apuesta mínima es de {min}."),
 ("La mise minimum est de {x}.", "The minimum bet is {x}.", "La apuesta mínima es de {x}."),
 ("La programmation à l'avance est réservée aux jeux casino (Lucky 7, Jackpot, Turbo).", "Advance scheduling is for casino games only (Lucky 7, Jackpot, Turbo).", "La programación anticipada está reservada a los juegos de casino (Lucky 7, Jackpot, Turbo)."),
 ("Langue", "Language", "Idioma"),
 ("Langue impossible pour le moment.", "Can't change language right now.", "No se puede cambiar el idioma en este momento."),
 ("Le jeu, la durée et le bouton sont déjà remplis sur l'écran suivant.", "The game, duration and button are already filled in on the next screen.", "El juego, la duración y el botón ya están completos en la siguiente pantalla."),
 ("Le montant doit être entre {a} et {b}.", "The amount must be between {a} and {b}.", "El importe debe estar entre {a} y {b}."),
 ("Le montant minimum est de {x}.", "The minimum amount is {x}.", "El importe mínimo es de {x}."),
 ("Le mot de passe doit contenir au moins 6 caractères.", "The password must be at least 6 characters.", "La contraseña debe tener al menos 6 caracteres."),
 ("Les coups à venir", "Upcoming rounds", "Próximas rondas"),
 ("Les {n} derniers affichés : les statistiques, elles, comptent tout.", "Showing the last {n}: the stats count everything.", "Se muestran las últimas {n}: las estadísticas lo cuentan todo."),
 ("Livre sterling", "Pound sterling", "Libra esterlina"),
 ("Lucky 7, Jackpot et Turbo : des jeux de hasard pur, sans lien avec les vrais marchés.", "Lucky 7, Jackpot and Turbo: pure games of chance, unrelated to real markets.", "Lucky 7, Jackpot y Turbo: juegos de puro azar, sin relación con los mercados reales."),
 ("Maintenant", "Now", "Ahora"),
 ("Mali", "Mali", "Mali"),
 ("Mise", "Bet", "Apuesta"),
 ("Mise dans", "Bet in", "Apuesta en"),
 ("Mises", "Staked", "Apostado"),
 ("Mises {amt}", "Staked {amt}", "Apostado {amt}"),
 ("Mon profil", "My profile", "Mi perfil"),
 ("Mon solde : {x}. Aller au profil.", "My balance: {x}. Go to profile.", "Mi saldo: {x}. Ir al perfil."),
 ("Montant de la mise", "Bet amount", "Importe de la apuesta"),
 ("Montant de mise invalide.", "Invalid bet amount.", "Importe de apuesta inválido."),
 ("Mot de passe", "Password", "Contraseña"),
 ("Mot de passe ({min} caractères minimum)", "Password ({min} characters minimum)", "Contraseña ({min} caracteres mínimo)"),
 ("Naira", "Naira", "Naira"),
 ("Navigation principale", "Main navigation", "Navegación principal"),
 ("Net", "Net", "Neto"),
 ("Niger", "Niger", "Níger"),
 ("Nigeria", "Nigeria", "Nigeria"),
 ("On ne programme pas au-delà de 24 heures.", "We don't schedule beyond 24 hours.", "No programamos más allá de 24 horas."),
 ("On te dit à l'avance s'il faut appuyer sur Hausse ou Baisse, et à quelle seconde exacte.", "We tell you in advance whether to press Up or Down, and at which exact second.", "Te decimos de antemano si debes pulsar Sube o Baja, y en qué segundo exacto."),
 ("Opération impossible pour le moment.", "Can't do that right now.", "No se puede realizar esta operación en este momento."),
 ("Pas de coup jouable pour l'instant : reviens dans une minute.", "No playable round right now: come back in a minute.", "No hay ronda jugable por ahora: vuelve en un minuto."),
 ("Pas de jeu casino", "No casino game", "No hay juego de casino"),
 ("Pas encore de compte ?", "No account yet?", "¿Aún no tienes cuenta?"),
 ("Passer", "Skip", "Omitir"),
 ("Pays", "Country", "País"),
 ("Pays-Bas", "Netherlands", "Países Bajos"),
 ("Pays et devise mis à jour.", "Country and currency updated.", "País y divisa actualizados."),
 ("Perdu −{amt}", "Lost −{amt}", "Perdido −{amt}"),
 ("Portugal", "Portugal", "Portugal"),
 ("Pour te fixer une limite de jeu.", "To set yourself a play limit.", "Para ponerte un límite de juego."),
 ("Premier trade guidé · {a}/{b}", "First guided trade · {a}/{b}", "Primera operación guiada · {a}/{b}"),
 ("Prix temporairement indisponible.", "Price temporarily unavailable.", "Precio no disponible temporalmente."),
 ("Prix temporairement indisponibles.", "Prices temporarily unavailable.", "Precios no disponibles temporalmente."),
 ("Prix temporairement indisponibles. Réessayez dans quelques secondes.", "Prices temporarily unavailable. Try again in a few seconds.", "Precios no disponibles temporalmente. Inténtalo de nuevo en unos segundos."),
 ("Profil", "Profile", "Perfil"),
 ("Profil temporairement indisponible.", "Profile temporarily unavailable.", "Perfil no disponible temporalmente."),
 ("Programmation impossible pour le moment.", "Can't schedule right now.", "No se puede programar en este momento."),
 ("Programmation introuvable ou déjà traitée.", "Scheduled bet not found or already handled.", "Apuesta programada no encontrada o ya procesada."),
 ("Programmation introuvable.", "Scheduled bet not found.", "Apuesta programada no encontrada."),
 ("Programmé ({n}/{max})", "Scheduled ({n}/{max})", "Programada ({n}/{max})"),
 ("Programmé(es)", "Scheduled", "Programadas"),
 ("Programmé(es) ({n})", "Scheduled ({n})", "Programadas ({n})"),
 ("Programmé(es) {amt}", "Scheduled {amt}", "Programadas {amt}"),
 ("Programmées ({n}/{max})", "Scheduled ({n}/{max})", "Programadas ({n}/{max})"),
 ("Précisez une devise ou un pays.", "Specify a currency or a country.", "Especifica una divisa o un país."),
 ("Prédiction gagnée", "Prediction won", "Predicción ganada"),
 ("Prédiction impossible pour le moment.", "Can't place a prediction right now.", "No se puede predecir en este momento."),
 ("Prédiction ratée", "Prediction lost", "Predicción perdida"),
 ("Prédis si le prix monte ou descend", "Predict whether the price goes up or down", "Predice si el precio sube o baja"),
 ("Préparer ma mise →", "Prepare my bet →", "Preparar mi apuesta →"),
 ("Quel jeu ?", "Which game?", "¿Qué juego?"),
 ("Quelle durée ?", "Which duration?", "¿Qué duración?"),
 ("Regarde le graphique en bougies, choisis une durée et une mise, puis touche Hausse ▲ ou Baisse ▼.", "Watch the candlestick chart, choose a duration and a bet, then tap Up ▲ or Down ▼.", "Mira el gráfico de velas, elige una duración y una apuesta, y luego toca Sube ▲ o Baja ▼."),
 ("Rejouer", "Replay", "Repetir"),
 ("Requête illisible.", "Unreadable request.", "Solicitud ilegible."),
 ("Reste sur cette page jusqu'au départ.", "Stay on this page until the start.", "Quédate en esta página hasta el inicio."),
 ("Retirer", "Withdraw", "Retirar"),
 ("Retirer du solde", "Withdraw from balance", "Retirar del saldo"),
 ("Retour", "Back", "Atrás"),
 ("Retrait impossible pour le moment.", "Can't withdraw right now.", "No se puede retirar en este momento."),
 ("Revenir à Maintenant", "Back to Now", "Volver a Ahora"),
 ("Reviens vite sur cette page, sinon la mise ne partira pas !", "Come back to this page quickly, or the bet won't go!", "¡Vuelve rápido a esta página o la apuesta no se realizará!"),
 ("Royaume-Uni", "United Kingdom", "Reino Unido"),
 ("Réduire les animations", "Reduce animations", "Reducir animaciones"),
 ("Réessayer", "Retry", "Reintentar"),
 ("Résultat", "Result", "Resultado"),
 ("Réussite", "Win rate", "Aciertos"),
 ("Se connecter", "Log in", "Iniciar sesión"),
 ("Se déconnecter", "Log out", "Cerrar sesión"),
 ("Service temporairement indisponible.", "Service temporarily unavailable.", "Servicio no disponible temporalmente."),
 ("Signaux", "Signals", "Señales"),
 ("Signaux casino", "Casino signals", "Señales de casino"),
 ("Solde", "Balance", "Saldo"),
 ("Solde insuffisant pour ce retrait.", "Insufficient balance for this withdrawal.", "Saldo insuficiente para este retiro."),
 ("Solde insuffisant pour cette mise.", "Insufficient balance for this bet.", "Saldo insuficiente para esta apuesta."),
 ("Solde, mises et gains s'affichent dans cette devise.", "Balance, bets and winnings show in this currency.", "El saldo, las apuestas y las ganancias se muestran en esta divisa."),
 ("Statistiques temporairement indisponibles.", "Stats temporarily unavailable.", "Estadísticas no disponibles temporalmente."),
 ("Suivant", "Next", "Siguiente"),
 ("Sénégal", "Senegal", "Senegal"),
 ("Ta session a expiré après 30 jours : reconnecte-toi pour continuer.", "Your session expired after 30 days: log in again to continue.", "Tu sesión caducó después de 30 días: inicia sesión de nuevo para continuar."),
 ("Tape un montant ou ajuste avec − et +. Si tu gagnes : mise rendue + {pct} % de bénéfice.", "Type an amount or adjust with − and +. If you win: bet back + {pct}% profit.", "Escribe un importe o ajústalo con − y +. Si ganas: apuesta devuelta + {pct} % de beneficio."),
 ("Temps restant : {label}", "Time left: {label}", "Tiempo restante: {label}"),
 ("Temps restant avant de miser : {x}", "Time left before betting: {x}", "Tiempo restante antes de apostar: {x}"),
 ("Terminés", "Finished", "Terminadas"),
 ("Terminé, calcul du résultat…", "Finished, calculating result…", "Terminado, calculando el resultado…"),
 ("Terminées", "Finished", "Terminadas"),
 ("Togo", "Togo", "Togo"),
 ("Toutes", "All", "Todas"),
 ("Ton mot de passe", "Your password", "Tu contraseña"),
 ("Ton solde commence à 0 : touche « Ajouter » dans ton profil pour le recharger. Aucun argent réel, jamais.", "Your balance starts at 0: tap “Add” in your profile to top it up. No real money, ever.", "Tu saldo empieza en 0: toca «Añadir» en tu perfil para recargarlo. Sin dinero real, nunca."),
 ("Touche « {game} » pour ouvrir la liste des {n} jeux : {list} (badge JEU).", "Tap “{game}” to open the list of {n} games: {list} (GAME badge).", "Toca «{game}» para abrir la lista de {n} juegos: {list} (insignia JUEGO)."),
 ("Tous les jeux", "All games", "Todos los juegos"),
 ("TradeFacile — Prédis si le prix monte ou descend", "TradeFacile — Predict whether the price goes up or down", "TradeFacile — Predice si el precio sube o baja"),
 ("Trader", "Trade", "Operar"),
 ("Trop de tentatives. Réessayez dans quelques minutes.", "Too many attempts. Try again in a few minutes.", "Demasiados intentos. Inténtalo de nuevo en unos minutos."),
 ("Trop tard : ce coup est passé. Choisis une autre heure dans « Départ ».", "Too late: this round is over. Choose another time in “Start”.", "Demasiado tarde: esta ronda ya pasó. Elige otra hora en «Inicio»."),
 ("Trop tard : la mise est déjà partie.", "Too late: the bet already went.", "Demasiado tarde: la apuesta ya se realizó."),
 ("Trop tôt : attends la fin du compte à rebours, le coup part à la seconde pile.", "Too early: wait for the countdown to end, the round starts on the exact second.", "Demasiado pronto: espera al final de la cuenta atrás, la ronda empieza en el segundo exacto."),
 ("Trop tôt ? Attends : le bouton conseillé ne s'arme que dans les 3 dernières secondes. En retard ? Le coup est raté : attends le suivant. Astuce : sur le trader, choisis ton heure dans « Départ » et ta mise partira toute seule, même si tu quittes l'app.", "Too early? Wait: the suggested button only arms in the last 3 seconds. Late? The round is missed: wait for the next one. Tip: on the trader, choose your time in “Start” and your bet will go off on its own, even if you leave the app.", "¿Demasiado pronto? Espera: el botón sugerido solo se activa en los últimos 3 segundos. ¿Tarde? La ronda se perdió: espera a la siguiente. Consejo: en el trader, elige tu hora en «Inicio» y tu apuesta se realizará sola, aunque salgas de la app."),
 ("Un combiné, c'est 2 à 5 prédictions.", "A combo is 2 to 5 predictions.", "Una combinada son de 2 a 5 predicciones."),
 ("Un compte existe déjà avec cet e-mail.", "An account already exists with this email.", "Ya existe una cuenta con este correo."),
 ("Valider demain {hm} →", "Confirm tomorrow {hm} →", "Confirmar mañana {hm} →"),
 ("Valider {hm} →", "Confirm {hm} →", "Confirmar {hm} →"),
 ("Voir les {n} prédictions en cours", "See the {n} open predictions", "Ver las {n} predicciones en curso"),
 ("demain {label}", "tomorrow {label}", "mañana {label}"),
 ("durée {dur}", "duration {dur}", "duración {dur}"),
 ("min", "min", "min"),
 ("prix en direct", "live price", "precio en directo"),
 ("précises, appuie sur :", "sharp, press:", "en punto, pulsa:"),
 ("recharge pour jouer", "top up to play", "recarga para jugar"),
 ("résultat…", "result…", "resultado…"),
 ("sec", "sec", "seg"),
 ("Écran {a} sur {b}", "Screen {a} of {b}", "Pantalla {a} de {b}"),
 ("Égalité : mise rendue", "Tie: bet refunded", "Empate: apuesta devuelta"),
 ("Égalité =", "Tie =", "Empate ="),
 ("États-Unis", "United States", "Estados Unidos"),
 ("à", "at", "a las"),
 ("« Égalité » = le prix ne bougera pas : garde ta mise pour le coup d'après.", "“Tie” = the price won't move: save your bet for the next round.", "«Empate» = el precio no se moverá: guarda tu apuesta para la próxima ronda."),
 ("À", "At", "A las"),
 ("À JOUER", "TO PLAY", "A JUGAR"),
 ("{dir} {amt} · {dur} s", "{dir} {amt} · {dur} s", "{dir} {amt} · {dur} s"),
 ("{list}. À la fin du compte à rebours, on compare le prix de fin au prix de départ.", "{list}. When the countdown ends, the end price is compared to the start price.", "{list}. Al final de la cuenta atrás, se compara el precio final con el precio inicial."),
 ("{m} min {s}", "{m} min {s}", "{m} min {s}"),
 ("{n} en cours", "{n} open", "{n} en curso"),
 ("{n} gagné", "{n} won", "{n} ganado"),
 ("{n} gagnés", "{n} won", "{n} ganados"),
 ("{n} perdu", "{n} lost", "{n} perdido"),
 ("{n} perdus", "{n} lost", "{n} perdidos"),
 ("{n} résultats : {w} · {l}", "{n} results: {w} · {l}", "{n} resultados: {w} · {l}"),
 ("{s} s", "{s} s", "{s} s"),
 ("▲ monte · ▼ descend", "▲ up · ▼ down", "▲ sube · ▼ baja"),
]

import glob

# Clés utilisées dans le code (doivent TOUTES être dans la table)
used = set()
for p in glob.glob("app/**/page.tsx", recursive=True) + glob.glob("components/*.tsx") + glob.glob("lib/*.ts*") + glob.glob("hooks/*.ts"):
    s = open(p).read()
    for m in re.finditer(r'(?:\btr?)\(\s*"((?:[^"\\]|\\.)*)"', s):
        used.add(m.group(1).encode().decode("unicode_escape") if "\\" in m.group(1) else m.group(1))
    for m in re.finditer(r'tr\(lang,\s*"((?:[^"\\]|\\.)*)"', s):
        used.add(m.group(1))
for p in glob.glob("app/api/**/route.ts", recursive=True):
    s = open(p).read()
    for m in re.finditer(r'fail\(\s*"[^"]*",\s*"((?:[^"\\]|\\.)*)"', s):
        used.add(m.group(1))
    for m in re.finditer(r'tr\(lang,\s*"((?:[^"\\]|\\.)*)"', s):
        used.add(m.group(1))
s = open("app/bienvenue/page.tsx").read()
for m in re.finditer(r'(?:title|text): "((?:[^"\\]|\\.)*)"', s):
    used.add(m.group(1))
used.add("Prix temporairement indisponibles. Réessayez dans quelques secondes.")
used.add("Cours temporairement indisponibles. Réessayez dans quelques secondes.")
used.add("Le mot de passe doit contenir au moins 6 caractères.")
used.add("Un combiné, c'est 2 à 5 prédictions.")
used.add("Connectez-vous pour continuer.")
used.add("Aujourd'hui"); used.add("Hier")
used.add("TradeFacile — Prédis si le prix monte ou descend")
used.add("Trader"); used.add("Signaux")
for c in ["Bénin","Burkina Faso","Côte d'Ivoire","Guinée-Bissau","Mali","Niger","Sénégal","Togo","Nigeria","Ghana","États-Unis","France","Allemagne","Belgique","Espagne","Italie","Portugal","Pays-Bas","Autre zone euro","Royaume-Uni"]:
    used.add(c)
for c in ["Dollar américain","Euro","Franc CFA (UEMOA)","Livre sterling","Naira","Cedi"]:
    used.add(c)
# commentaires/doc (pas des vraies clés)
used.discard("...")
used.discard("Voir les {n} prédictions")

table = {k: (en, es) for k, en, es in T}
missing = sorted(used - set(table))
extra = sorted(set(table) - used)
print("clés utilisées:", len(used), "| table:", len(table))
print("MANQUANTES:", missing)
print("EN TROP:", extra)

def ts(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'

lines = []
lines.append("/**")
lines.append(" * Multilingue (français, anglais, espagnol) : le texte FRANÇAIS sert de clé,")
lines.append(' * t("...") renvoie la traduction ou le français si elle manque (jamais de vide).')
lines.append(" * Variables : t(\"Voir les {n} prédictions\", { n: 3 }).")
lines.append(" * Dictionnaires générés depuis tools/mkdict.py (NE PAS éditer à la main).")
lines.append(" */")
lines.append("")
lines.append('export type Lang = "fr" | "en" | "es";')
lines.append("")
lines.append("export const LANGS: { code: Lang; label: string }[] = [")
lines.append('  { code: "fr", label: "Français" },')
lines.append('  { code: "en", label: "English" },')
lines.append('  { code: "es", label: "Español" },')
lines.append("];")
lines.append("")
lines.append("export function isLang(v: unknown): v is Lang {")
lines.append('  return v === "fr" || v === "en" || v === "es";')
lines.append("}")
lines.append("")
lines.append("export const STRINGS_EN: Record<string, string> = {")
for k, en, es in sorted(T):
    lines.append(f"  {ts(k)}: {ts(en)},")
lines.append("};")
lines.append("")
lines.append("export const STRINGS_ES: Record<string, string> = {")
for k, en, es in sorted(T):
    lines.append(f"  {ts(k)}: {ts(es)},")
lines.append("};")
lines.append("")
lines.append("function interpolate(text: string, vars?: Record<string, string | number>): string {")
lines.append("  if (!vars) return text;")
lines.append(r"  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));")
lines.append("}")
lines.append("")
lines.append("/** Traduction brute (hors composants). En composants : useLang().t. */")
lines.append("export function tr(lang: Lang, key: string, vars?: Record<string, string | number>): string {")
lines.append('  const dict = lang === "en" ? STRINGS_EN : lang === "es" ? STRINGS_ES : null;')
lines.append("  return interpolate((dict && dict[key]) || key, vars);")
lines.append("}")
lines.append("")
open("lib/i18n.ts", "w").write("\n".join(lines))
print("lib/i18n.ts écrit")
