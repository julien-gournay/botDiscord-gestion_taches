require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    REST,
    Routes,
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const TASKS_FILE = path.join(__dirname, 'tasks.json');
const APP_VERSION = "1.0.0"; // Version de l'application

// Fonction pour charger les tâches
function loadTasks() {
    if (fs.existsSync(TASKS_FILE)) {
        const data = fs.readFileSync(TASKS_FILE, 'utf8');
        return JSON.parse(data);
    }
    return [];
}

let todoList = loadTasks();

// Fonction pour sauvegarder les tâches
function saveTasks() {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(todoList, null, 4), 'utf8');
}

// Génère un ID unique
function generateTaskId() {
    return Math.floor(1000 + Math.random() * 9000);
}

// Trie les tâches par priorité
function sortByPriority() {
    const priorityOrder = { 'I': 3, 'M': 2, 'F': 1 };
    todoList.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
}

// 🚀 Enregistrement des commandes Slash au démarrage
client.once('ready', async () => {
    console.log('✅ Bot opérationnel !');
    client.user.setActivity('Gestion des tâches', { type: 'PLAYING' });

    const commands = [
        {
            name: 'add',
            description: 'Ajoute une tâche à la todo list',
            options: [
                {
                    name: 'description',
                    type: 3, // STRING
                    description: "Description de la tâche",
                    required: true
                },
                {
                    name: 'priority',
                    type: 3, // STRING
                    description: "Priorité de la tâche (F = Faible, M = Moyenne, I = Importante)",
                    required: true,
                    choices: [
                        { name: 'Faible', value: 'F' },
                        { name: 'Moyenne', value: 'M' },
                        { name: 'Importante', value: 'I' }
                    ]
                }
            ]
        },
        {
            name: 'liste',
            description: 'Affiche la liste des tâches'
        },
        {
            name: 'effectué',
            description: 'Supprime une tâche via une liste dynamique',
            options: [
                {
                    name: 'task',
                    type: 3, // STRING
                    description: 'Choisissez une tâche à supprimer',
                    required: true,
                    choices: todoList.map(task => ({
                        name: `${task.task} (ID: ${task.id})`,
                        value: task.id.toString()
                    }))
                }
            ]
        },
        {
            name: 'modif',
            description: 'Modifie une tâche existante',
            options: [
                {
                    name: 'task',
                    type: 3, // STRING
                    description: 'Choisissez une tâche à modifier',
                    required: true,
                    choices: todoList.map(task => ({
                        name: `${task.task} (ID: ${task.id})`,
                        value: task.id.toString()
                    }))
                },
                {
                    name: 'new_description',
                    type: 3, // STRING
                    description: "Nouvelle description de la tâche",
                    required: true
                }
            ]
        },
        {
            name: 'version',
            description: 'Affiche la version de l’application'
        },
        {
            name: 'help',
            description: 'Affiche l\'aide et les instructions du bot'
        }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('🔄 Mise à jour des commandes Slash...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Commandes Slash enregistrées !');
    } catch (error) {
        console.error("❌ Erreur d'enregistrement des commandes :", error);
    }
});

// 🎯 Gestion des interactions Slash
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    // Ajouter une tâche
    if (commandName === 'add') {
        const task = interaction.options.getString('description');
        const priority = interaction.options.getString('priority');
        const taskId = generateTaskId();
        const creator = interaction.user.tag;
        const creationDate = new Date().toLocaleString("fr-FR");

        todoList.push({ id: taskId, task, priority, creator, creationDate });
        saveTasks();

        await interaction.reply(`✅ **Tâche ajoutée** : \`${task}\` (ID: \`${taskId}\`, Créé par: **${creator}** le **${creationDate}**)`);
    }

    // Afficher la liste des tâches
    if (commandName === 'liste') {
        if (todoList.length === 0) {
            return interaction.reply("🔴 Votre Todo List est vide.");
        }

        sortByPriority(); // Trie la liste par priorité

        const embed = new EmbedBuilder()
            .setColor("#2DB6F5")
            .setTitle("📋 Todo List")
            .setDescription("Les tâches sont classées par priorité :")
            .setTimestamp();

        let tasksByPriority = { 'I': [], 'M': [], 'F': [] };

        // Regroupe les tâches par priorité
        todoList.forEach(task => {
            tasksByPriority[task.priority].push(`→ **${task.task}** \n(ID: \`${task.id}\`, Créé par: ${task.creator}, le ${task.creationDate})`);
        });

        // Ajoute les sections pour chaque priorité si elles ont des tâches
        if (tasksByPriority['I'].length > 0) {
            embed.addFields({ name: "🔴  **Tâches Importantes**", value: tasksByPriority['I'].join("\n") });
        }
        if (tasksByPriority['M'].length > 0) {
            embed.addFields({ name: "🟡  **Tâches Moyennes**", value: tasksByPriority['M'].join("\n") });
        }
        if (tasksByPriority['F'].length > 0) {
            embed.addFields({ name: "🟢  **Tâches Faibles**", value: tasksByPriority['F'].join("\n") });
        }

        await interaction.reply({ embeds: [embed] });
    }


    // Supprimer une tâche avec menu déroulant
    if (commandName === 'effectué') {
        const taskId = interaction.options.getString('task');
        const task = todoList.find(t => t.id.toString() === taskId);

        if (task) {
            const index = todoList.indexOf(task);
            todoList.splice(index, 1);
            saveTasks();
            await interaction.reply(`✅ Tâche supprimée : **${task.task}** (ID: \`${taskId}\`).`);
        } else {
            await interaction.reply("⚠️ Tâche non trouvée.");
        }
    }

    // Modifier une tâche
    if (commandName === 'modif') {
        const taskId = interaction.options.getString('task');
        const newTaskDescription = interaction.options.getString('new_description');
        const task = todoList.find(t => t.id.toString() === taskId);

        if (!task) {
            return interaction.reply("⚠️ Tâche non trouvée.");
        }

        task.task = newTaskDescription;
        saveTasks();
        await interaction.reply(`✅ Tâche modifiée : \`${newTaskDescription}\` (ID: \`${taskId}\`).`);
    }

    // Afficher la version de l'application
    if (commandName === 'version') {
        await interaction.reply(`🔹 **Version actuelle de l'application** : \`${APP_VERSION}\``);
    }

    if (commandName === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor("#0099FF")
            .setTitle("📘 Commandes du Bot : Aide")
            .setDescription("Voici les commandes disponibles pour gérer vos tâches.")
            .addFields(
                {
                    name: "/add",
                    value: "Ajoute une tâche à la todo list. Vous devez fournir une **description** et une **priorité** (Faible, Moyenne, Importante).",
                    inline: false
                },
                {
                    name: "/liste",
                    value: "Affiche toutes les tâches dans la liste, triées par priorité.",
                    inline: false
                },
                {
                    name: "/effectué",
                    value: "Supprime une tâche en la sélectionnant dans une liste dynamique. Choisissez la tâche à supprimer.",
                    inline: false
                },
                {
                    name: "/modif",
                    value: "Modifie une tâche existante. Vous devez choisir la tâche à modifier et fournir une nouvelle description.",
                    inline: false
                },
                {
                    name: "/version",
                    value: "Affiche la version actuelle de l'application.",
                    inline: false
                }
            )
            .setFooter({ text: "Utilisez les commandes pour gérer vos tâches efficacement." })
            .setTimestamp();

        await interaction.reply({ embeds: [helpEmbed] });
    }
});

// Connexion du bot
client.login(process.env.DISCORD_TOKEN);
