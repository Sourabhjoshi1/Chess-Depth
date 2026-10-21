// ChessDepth Academy - Firebase settings for the Student Area.
//
// Paste the values from: Firebase console -> Project settings -> General ->
// "Your apps" -> Web app -> "SDK setup and configuration" -> Config.
// These values are not secret: Firebase protects the PDFs with the
// security rules in storage.rules, not by hiding this file.
export const firebaseConfig = {
  apiKey: "PASTE_API_KEY_HERE",
  authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

// Optional: nicer names and the display order for course folders.
// The key is the folder name inside "materials/" in Firebase Storage.
// Folders not listed here still appear, with a name made from the folder name.
export const courseNames = {
  "beginner": "Beginner's Blueprint",
  "advanced-beginner": "Beyond the Basics",
  "intermediate": "Intermediate Positional Play",
  "openings": "Advanced Opening Repertoire",
  "endgames": "Endgame Mastery",
  "tactics": "Tactics & Calculation",
  "psychology": "Chess Psychology"
};
