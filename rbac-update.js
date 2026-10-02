const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'apps/api/src/routes');

const replacements = {
  // System & Infrastructure (ADMIN, SUPER_ADMIN)
  'billing.ts': ['ADMIN', 'SUPER_ADMIN'],
  'integrations.ts': ['ADMIN', 'SUPER_ADMIN'],
  'audit.ts': ['ADMIN', 'SUPER_ADMIN'],
  'workspaces.ts': ['ADMIN', 'SUPER_ADMIN'],
  'analytics.ts': ['ADMIN', 'SUPER_ADMIN'],
  'ads.ts': ['ADMIN', 'SUPER_ADMIN'],
  
  // Operations Level (MANAGER, ADMIN, SUPER_ADMIN)
  'templates.ts': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'chatbots.ts': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'knowledge.ts': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'flows.ts': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'broadcasts.ts': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'drips.ts': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'copilot.ts': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  
  // Execution Level (AGENT, MANAGER, ADMIN, SUPER_ADMIN)
  'payments.ts': ['AGENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'messages.ts': ['AGENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'commerce.ts': ['AGENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
  'catalog.ts': ['AGENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']
};

for (const [file, roles] of Object.entries(replacements)) {
  const filePath = path.join(routesDir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace onRequest
    content = content.replace(/onRequest: \[\(fastify as any\)\.authenticate\]/g, 
      `onRequest: [(fastify as any).requireRole(${JSON.stringify(roles)})]`);
      
    content = content.replace(/onRequest: \[\(app as any\)\.authenticate\]/g, 
      `onRequest: [(app as any).requireRole(${JSON.stringify(roles)})]`);
      
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
}

// Complex files with both Read & Write differences
const complexFiles = {
  'contacts.ts': {
    write: ['AGENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    read: ['VIEWER', 'AGENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']
  },
  'conversations.ts': {
    write: ['AGENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    read: ['VIEWER', 'AGENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']
  }
};

for (const [file, rules] of Object.entries(complexFiles)) {
  const filePath = path.join(routesDir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // For fastify.get / app.get with onRequest
    content = content.replace(/(fastify|app)\.get\("([^"]*)", \{\s*onRequest: \[\((fastify|app) as any\)\.authenticate\]\s*\}/g, 
      `$1.get("$2", { onRequest: [($3 as any).requireRole(${JSON.stringify(rules.read)})] }`);
      
    // For fastify.post, patch, delete with onRequest
    content = content.replace(/(fastify|app)\.(post|patch|delete|put)\("([^"]*)", \{\s*onRequest: \[\((fastify|app) as any\)\.authenticate\]\s*\}/g, 
      `$1.$2("$3", { onRequest: [($4 as any).requireRole(${JSON.stringify(rules.write)})] }`);
      
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file} (Complex)`);
  }
}
