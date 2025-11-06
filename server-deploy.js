const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { v4: uuidv4 } = require('uuid');
const { OpenAI } = require('openai');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database('./data/chatbot.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  db.serialize(() => {
    // Create FAQs table
    db.run(`CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      language VARCHAR(10) DEFAULT 'en',
      category VARCHAR(50),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create documents table
    db.run(`CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      content TEXT,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create chat history table
    db.run(`CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      user_message TEXT NOT NULL,
      bot_response TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create settings table
    db.run(`CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL
    )`);

    // Check if FAQs exist, if not insert sample data
    db.get("SELECT COUNT(*) as count FROM faqs", (err, row) => {
      if (err) {
        console.error('Error checking FAQs:', err);
        return;
      }
      
      if (row.count === 0) {
        console.log('No FAQs found, inserting sample data...');
        insertSampleFAQs();
      }
    });
  });
}

// Insert sample FAQs
function insertSampleFAQs() {
  const sampleFAQs = [
    // Emergency Services
    {
      question: "What should I do if my child is missing?",
      answer: "If your child is missing, immediately contact local authorities and UNICEF emergency services. Call the emergency hotline and provide a detailed description including last known location, clothing, and any distinguishing features.",
      category: "emergency_services",
      language: "en"
    },
    {
      question: "How can I report child abuse or neglect?",
      answer: "Report child abuse or neglect immediately to local child protection authorities or UNICEF. Do not confront the abuser directly. Ensure the child's safety first, then contact emergency services or child protection hotlines.",
      category: "emergency_services",
      language: "en"
    },
    {
      question: "What are the emergency contact numbers in Gaza?",
      answer: "Emergency contacts in Gaza include: Child Protection Emergency Line, UNICEF Hotline, and local police emergency services. Contact your local UNICEF office for current emergency numbers specific to your area.",
      category: "emergency_services",
      language: "en"
    },
    
    // Legal Support
    {
      question: "How can I obtain documentation for my child?",
      answer: "Contact local civil registration authorities or UNICEF support services. You may need birth certificates, family registration documents, or identity papers. UNICEF can assist with documentation processes and connecting you with appropriate legal services.",
      category: "legal_support",
      language: "en"
    },
    {
      question: "What legal rights do children have in conflict zones?",
      answer: "Children in conflict zones have fundamental rights including protection from violence, access to education, healthcare, and family unity. International humanitarian law protects children, and UNICEF works to ensure these rights are upheld.",
      category: "legal_support",
      language: "en"
    },
    {
      question: "How can I seek asylum or refugee status for my family?",
      answer: "Contact UNHCR or local refugee assistance organizations. You may need to file an asylum application, provide documentation, and attend interviews. UNICEF can provide referrals to legal assistance and refugee support services.",
      category: "legal_support",
      language: "en"
    },

    // Health Services
    {
      question: "Where can I find medical care for my child?",
      answer: "UNICEF-supported health centers, local hospitals, and mobile health units provide medical care for children. Contact your local health authority or UNICEF office to find the nearest available medical facilities and services.",
      category: "health_services",
      language: "en"
    },
    {
      question: "How can I access mental health support for my child?",
      answer: "UNICEF provides psychosocial support services through trained counselors and community programs. Contact local mental health services, school counselors, or UNICEF support lines for age-appropriate mental health assistance.",
      category: "health_services",
      language: "en"
    },
    {
      question: "What vaccinations are available for children?",
      answer: "UNICEF supports vaccination campaigns for common childhood diseases. Contact local health centers or UNICEF mobile units for information about available vaccination schedules and locations.",
      category: "health_services",
      language: "en"
    },

    // Education
    {
      question: "How can my child continue their education?",
      answer: "UNICEF supports various education programs including formal schooling, informal education, and distance learning. Contact local schools, education authorities, or UNICEF education coordinators for enrollment and support options.",
      category: "education",
      language: "en"
    },
    {
      question: "Are there educational materials available for children?",
      answer: "UNICEF provides educational materials, textbooks, and learning resources. Digital learning platforms and printed materials are available through schools, community centers, and UNICEF distribution points.",
      category: "education",
      language: "en"
    },
    {
      question: "How can I help my child with trauma and stress?",
      answer: "UNICEF offers psychosocial support programs, child-friendly activities, and counseling services. Maintain routines, provide emotional support, and connect with community support groups. Seek professional help if needed.",
      category: "education",
      language: "en"
    },

    // Family Services
    {
      question: "How can I find family members who are separated?",
      answer: "Contact family tracing services through UNICEF or Red Cross organizations. Provide detailed information about missing family members including names, ages, last known locations, and contact information.",
      category: "family_services",
      language: "en"
    },
    {
      question: "What support is available for single parents?",
      answer: "UNICEF provides support for single parents including financial assistance, childcare services, counseling, and connections to community resources. Contact local social services or UNICEF family support programs.",
      category: "family_services",
      language: "en"
    },
    {
      question: "How can I register for humanitarian assistance?",
      answer: "Register for humanitarian assistance through local distribution points, UN agencies, or community organizations. Bring identification documents and provide information about your family's needs and current situation.",
      category: "family_services",
      language: "en"
    },

    // General Support
    {
      question: "How can I contact UNICEF for help?",
      answer: "You can contact UNICEF through local offices, hotlines, community centers, or online platforms. UNICEF staff are available to provide assistance, information, and connections to essential services.",
      category: "general_support",
      language: "en"
    },
    {
      question: "What information should I keep ready for emergencies?",
      answer: "Keep important documents like identification papers, medical records, family photos, emergency contact numbers, and essential supplies readily accessible. Also memorize key family information and safe meeting points.",
      category: "general_support",
      language: "en"
    },
    {
      question: "How can I help protect my child during conflict?",
      answer: "Keep children away from danger zones, maintain family unity, follow safety instructions from authorities, and teach children about protective measures. Stay informed about security situations and evacuation procedures.",
      category: "general_support",
      language: "en"
    }
  ];

  const stmt = db.prepare("INSERT INTO faqs (question, answer, category, language) VALUES (?, ?, ?, ?)");
  
  sampleFAQs.forEach(faq => {
    stmt.run(faq.question, faq.answer, faq.category, faq.language);
  });
  
  stmt.finalize();
  console.log('Sample FAQs inserted successfully');
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get all FAQs
app.get('/api/faqs', (req, res) => {
  const { category, language } = req.query;
  let query = "SELECT * FROM faqs WHERE 1=1";
  const params = [];

  if (category) {
    query += " AND category = ?";
    params.push(category);
  }

  if (language) {
    query += " AND language = ?";
    params.push(language);
  }

  query += " ORDER BY created_at DESC";

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching FAQs:', err);
      res.status(500).json({ error: 'Failed to fetch FAQs' });
      return;
    }
    res.json(rows);
  });
});

// Add new FAQ
app.post('/api/faqs', (req, res) => {
  const { question, answer, category, language = 'en' } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: 'Question and answer are required' });
  }

  db.run(
    "INSERT INTO faqs (question, answer, category, language) VALUES (?, ?, ?, ?)",
    [question, answer, category, language],
    function(err) {
      if (err) {
        console.error('Error adding FAQ:', err);
        res.status(500).json({ error: 'Failed to add FAQ' });
        return;
      }
      res.json({ id: this.lastID, question, answer, category, language });
    }
  );
});

// Update FAQ
app.put('/api/faqs/:id', (req, res) => {
  const { id } = req.params;
  const { question, answer, category, language } = req.body;

  db.run(
    "UPDATE faqs SET question = ?, answer = ?, category = ?, language = ? WHERE id = ?",
    [question, answer, category, language, id],
    function(err) {
      if (err) {
        console.error('Error updating FAQ:', err);
        res.status(500).json({ error: 'Failed to update FAQ' });
        return;
      }
      res.json({ id, question, answer, category, language });
    }
  );
});

// Delete FAQ
app.delete('/api/faqs/:id', (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM faqs WHERE id = ?", [id], function(err) {
    if (err) {
      console.error('Error deleting FAQ:', err);
      res.status(500).json({ error: 'Failed to delete FAQ' });
      return;
    }
    res.json({ message: 'FAQ deleted successfully' });
  });
});

// Chat API
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, language = 'en' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get relevant FAQs for context
    const faqs = await getRelevantFAQs(message, language);
    
    // Generate response using OpenAI
    const response = await generateResponse(message, faqs, language);
    
    // Store chat history
    const chatSessionId = sessionId || uuidv4();
    storeChatHistory(chatSessionId, message, response);
    
    res.json({
      response,
      sessionId: chatSessionId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Get chat history
app.get('/api/chat/history/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  db.all(
    "SELECT * FROM chat_history WHERE session_id = ? ORDER BY timestamp DESC",
    [sessionId],
    (err, rows) => {
      if (err) {
        console.error('Error fetching chat history:', err);
        res.status(500).json({ error: 'Failed to fetch chat history' });
        return;
      }
      res.json(rows);
    }
  );
});

// Get categories
app.get('/api/categories', (req, res) => {
  db.all("SELECT DISTINCT category FROM faqs", (err, rows) => {
    if (err) {
      console.error('Error fetching categories:', err);
      res.status(500).json({ error: 'Failed to fetch categories' });
      return;
    }
    res.json(rows.map(row => row.category));
  });
});

// Helper functions
async function getRelevantFAQs(message, language) {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM faqs WHERE language = ? ORDER BY created_at DESC LIMIT 10";
    
    db.all(query, [language], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

async function generateResponse(message, faqs, language) {
  try {
    const context = faqs.map(faq => 
      `Q: ${faq.question}\nA: ${faq.answer}\nCategory: ${faq.category}`
    ).join('\n\n');

    const systemPrompt = `You are a helpful UNICEF child protection assistant providing information and support for families in Gaza. 
You should provide accurate, compassionate, and practical advice based on available resources and services.

IMPORTANT GUIDELINES:
- Always prioritize child safety and well-being
- Provide specific, actionable information
- Include relevant contact information when available
- Be sensitive to the trauma and stress families may be experiencing
- If you cannot help, direct them to appropriate professional services
- Keep responses concise but comprehensive
- Use ${language} for your response

Available resources and FAQs:
${context}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI error:', error);
    // Fallback to simple FAQ matching
    return generateFallbackResponse(message, faqs);
  }
}

function generateFallbackResponse(message, faqs) {
  const lowerMessage = message.toLowerCase();
  
  // Simple keyword matching
  for (const faq of faqs) {
    if (lowerMessage.includes('emergency') && faq.category === 'emergency_services') {
      return faq.answer;
    }
    if (lowerMessage.includes('medical') && faq.category === 'health_services') {
      return faq.answer;
    }
    if (lowerMessage.includes('legal') && faq.category === 'legal_support') {
      return faq.answer;
    }
    if (lowerMessage.includes('education') && faq.category === 'education') {
      return faq.answer;
    }
  }
  
  // Default response
  return "I understand you're looking for help. Please contact UNICEF emergency services or your local child protection authorities for immediate assistance. If you have a specific question about child protection services, please try rephrasing it.";
}

function storeChatHistory(sessionId, userMessage, botResponse) {
  db.run(
    "INSERT INTO chat_history (session_id, user_message, bot_response) VALUES (?, ?, ?)",
    [sessionId, userMessage, botResponse],
    (err) => {
      if (err) {
        console.error('Error storing chat history:', err);
      }
    }
  );
}

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 UNICEF Child Protection Chatbot running on port ${PORT}`);
  console.log(`📱 Customer Chat: http://localhost:${PORT}/`);
  console.log(`🔧 Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`❤️  Supporting families in Gaza with AI-powered child protection information`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});