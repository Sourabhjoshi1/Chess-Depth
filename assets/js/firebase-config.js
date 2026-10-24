// ChessDepth Academy - Firebase settings for the Student Area.
//
// Paste the values from: Firebase console -> Project settings -> General ->
// "Your apps" -> Web app -> "SDK setup and configuration" -> Config.
// These values are not secret: Firebase protects the PDFs with the
// security rules in storage.rules, not by hiding this file.
export const firebaseConfig = {
  apiKey: "AIzaSyDQEgk8xpD8TM_MUQGQhAgg6nET15JKPLY",
  authDomain: "chessdepth-58b83.firebaseapp.com",
  projectId: "chessdepth-58b83",
  storageBucket: "chessdepth-58b83.firebasestorage.app",
  messagingSenderId: "137134134481",
  appId: "1:137134134481:web:a19bc3874ab703418621f0",
  measurementId: "G-TXG0NYJD0Y"
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
