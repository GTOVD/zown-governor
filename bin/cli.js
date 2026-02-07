#!/usr/bin/env node

const { Command } = require('commander');
const Governor = require('../src/index.js');
const path = require('path');
const fs = require('fs');

const program = new Command();
const governor = new Governor();

program
  .name('zown-governor')
  .description('An agentic governance tool for budget optimization and task management.')
  .version('1.0.0');

program.command('vision')
  .description('Run Vision-to-Action backlog generator')
  .action(async () => {
    const generateBacklog = require('../src/nexus/vision.js');
    await generateBacklog();
  });

program.command('init')
  .description('Initialize the governor state file')
  .action(() => {
    console.log(JSON.stringify(governor.init(), null, 2));
  });

program.command('status')
  .description('Get the current dynamic status (GREEN/YELLOW/RED)')
  .option('-a, --analytics', 'Include analytics summary')
  .action((options) => {
    const status = governor.getDynamicStatus();
    if (options.analytics) {
      status.analytics = governor.analytics.getSummary();
    }
    console.log(JSON.stringify(status, null, 2));
  });

program.command('log <n> [tokens]')
  .description('Log usage (increment counters)')
  .action((n, tokens) => {
    governor.incrementUsage(parseInt(n || 1), parseInt(tokens || 0));
    console.log(`Usage logged: ${n} requests, ${tokens || 0} tokens.`);
  });

program.command('next')
  .description('Get the next task based on priority and budget')
  .action(() => {
    console.log(JSON.stringify(governor.getNextTask(), null, 2));
  });

program.command('list')
  .description('List tasks')
  .argument('[status]', 'Filter by status (pending, in_progress, completed, failed)')
  .action((status) => {
    console.log(JSON.stringify(governor.getTasks(status), null, 2));
  });

program.command('add')
  .description('Add a new task')
  .argument('<title>', 'Task title')
  .argument('[priority]', 'Task priority (low, medium, high, critical)', 'medium')
  .argument('[description]', 'Task description', '')
  .action((title, priority, description) => {
    console.log(JSON.stringify(governor.addTask(title, priority, description), null, 2));
  });

program.command('complete')
  .description('Mark a task as completed')
  .argument('<id>', 'Task ID')
  .argument('[result]', 'Result summary', 'Done')
  .action((id, result) => {
    if (governor.completeTask(id, result)) {
      console.log(`Task ${id} marked completed.`);
    } else {
      console.error(`Task ${id} not found.`);
    }
  });

program.command('fail')
  .description('Mark a task as failed')
  .argument('<id>', 'Task ID')
  .argument('[reason]', 'Failure reason', 'Failed')
  .action((id, reason) => {
    if (governor.failTask(id, reason)) {
      console.log(`Task ${id} marked failed.`);
    } else {
      console.error(`Task ${id} not found.`);
    }
  });

program.command('update')
  .description('Update a task')
  .argument('<id>', 'Task ID')
  .option('-t, --title <title>', 'New title')
  .option('-p, --priority <priority>', 'New priority')
  .option('-d, --description <description>', 'New description')
  .option('-s, --status <status>', 'New status')
  .action((id, options) => {
      const updates = {};
      if (options.title) updates.title = options.title;
      if (options.priority) updates.priority = options.priority;
      if (options.description) updates.description = options.description;
      if (options.status) updates.status = options.status;
      
      const result = governor.updateTask(id, updates);
      if (result) {
          console.log(JSON.stringify(result, null, 2));
      } else {
          console.error(`Task ${id} not found or no valid updates provided.`);
      }
  });

program.command('delete')
  .description('Delete a task')
  .argument('<id>', 'Task ID')
  .action((id) => {
      if (governor.deleteTask(id)) {
          console.log(`Task ${id} deleted.`);
      } else {
          console.error(`Task ${id} not found.`);
      }
  });

program.command('heal')
  .description('Self-heal orphaned in_progress tasks')
  .action(() => {
    console.log(JSON.stringify(governor.selfHeal(), null, 2));
  });

program.command('recap')
  .description('Generate a daily technical recap')
  .action(async () => {
    const RecapGenerator = require('../src/recap.js');
    const generator = new RecapGenerator(governor);
    const result = await generator.generateRecap();
    console.log(JSON.stringify(result, null, 2));
  });

program.command('vault')
  .description('Manage encrypted API keys')
  .argument('<action>', 'Action: list, set, get')
  .argument('[name]', 'Secret name')
  .argument('[value]', 'Secret value (for set)')
  .action((action, name, value) => {
    const Vault = require('../src/vault/vault.js');
    const vault = new Vault();
    
    if (action === 'list') {
      console.log(JSON.stringify(vault.listSecrets(), null, 2));
    } else if (action === 'set') {
      vault.saveSecret(name, value);
      console.log(`Secret ${name} saved.`);
    } else if (action === 'get') {
      const secret = vault.getSecret(name);
      if (secret) {
        console.log(JSON.stringify(secret, null, 2));
      } else {
        console.error(`Secret ${name} not found.`);
      }
    }
  });

program.command('domains')
  .description('Manage autonomous domains (Project Permanence)')
  .argument('<action>', 'Action: list, register, check')
  .argument('[domain]', 'Domain name')
  .action(async (action, domain) => {
    const DomainManager = require('../src/skills/permanence.js');
    const dm = new DomainManager();

    try {
      if (action === 'list') {
        console.log(JSON.stringify(dm.listManagedDomains(), null, 2));
      } else if (action === 'check') {
        const available = await dm.checkAvailability(domain);
        console.log(`Domain ${domain} availability: ${available}`);
      } else if (action === 'register') {
        const result = await dm.registerDomain(domain);
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error(`Domain error: ${error.message}`);
    }
  });

program.parse();
