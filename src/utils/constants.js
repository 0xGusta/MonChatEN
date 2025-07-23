export const CONTRACT_ADDRESS = "0xB08111985e1a891605fa095AB9d52A93aDdC95a0";

export const ABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_moderador",
				"type": "address"
			}
		],
		"name": "adicionarModerador",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_novoUsuario",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "_newProfilePicHash",
				"type": "string"
			}
		],
		"name": "atualizarPerfil",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_endereco",
				"type": "address"
			}
		],
		"name": "banirUsuario",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_endereco",
				"type": "address"
			}
		],
		"name": "desbanirUsuario",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_id",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "_novoConteudo",
				"type": "string"
			}
		],
		"name": "editarMensagem",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_conteudo",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "_imageHash",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "_respondeA",
				"type": "uint256"
			}
		],
		"name": "enviarMensagem",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address payable",
				"name": "_para",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_valor",
				"type": "uint256"
			}
		],
		"name": "enviarMon",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_id",
				"type": "uint256"
			}
		],
		"name": "excluirMensagem",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "id",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "novoConteudo",
				"type": "string"
			}
		],
		"name": "MensagemEditada",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "id",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "remetente",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "usuario",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "conteudo",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "imageHash",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "respondeA",
				"type": "uint256"
			}
		],
		"name": "MensagemEnviada",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "id",
				"type": "uint256"
			}
		],
		"name": "MensagemExcluida",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "moderador",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "usuarioModerador",
				"type": "string"
			}
		],
		"name": "ModeradorAdicionado",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "moderador",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "usuarioModerador",
				"type": "string"
			}
		],
		"name": "ModeradorRemovido",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "de",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "para",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "valor",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "mensagemChat",
				"type": "string"
			}
		],
		"name": "MonEnviado",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_usuario",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "_profilePicHash",
				"type": "string"
			}
		],
		"name": "registrarUsuario",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_moderador",
				"type": "address"
			}
		],
		"name": "removerModerador",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_valor",
				"type": "uint256"
			}
		],
		"name": "retirarMon",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "endereco",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "usuarioBanido",
				"type": "string"
			}
		],
		"name": "UsuarioBanido",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "endereco",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "usuarioDesbanido",
				"type": "string"
			}
		],
		"name": "UsuarioDesbanido",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "endereco",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "novoUsuario",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "newProfilePicHash",
				"type": "string"
			}
		],
		"name": "UsuarioEditado",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "endereco",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "usuario",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "profilePicHash",
				"type": "string"
			}
		],
		"name": "UsuarioRegistrado",
		"type": "event"
	},
	{
		"stateMutability": "payable",
		"type": "receive"
	},
	{
		"inputs": [],
		"name": "contadorMensagens",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "dono",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "mensagens",
		"outputs": [
			{
				"internalType": "address",
				"name": "remetente",
				"type": "address"
			},
			{
				"internalType": "string",
				"name": "usuario",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "conteudo",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "imageHash",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			},
			{
				"internalType": "bool",
				"name": "excluida",
				"type": "bool"
			},
			{
				"internalType": "uint256",
				"name": "respondeA",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "moderadores",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_id",
				"type": "uint256"
			}
		],
		"name": "obterMensagem",
		"outputs": [
			{
				"internalType": "address",
				"name": "remetente",
				"type": "address"
			},
			{
				"internalType": "string",
				"name": "usuario",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "conteudo",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "imageHash",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			},
			{
				"internalType": "bool",
				"name": "excluida",
				"type": "bool"
			},
			{
				"internalType": "uint256",
				"name": "respondeA",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_pagina",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_itensPorPagina",
				"type": "uint256"
			}
		],
		"name": "obterMensagensPaginadas",
		"outputs": [
			{
				"components": [
					{
						"internalType": "address",
						"name": "remetente",
						"type": "address"
					},
					{
						"internalType": "string",
						"name": "usuario",
						"type": "string"
					},
					{
						"internalType": "string",
						"name": "conteudo",
						"type": "string"
					},
					{
						"internalType": "string",
						"name": "imageHash",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "timestamp",
						"type": "uint256"
					},
					{
						"internalType": "bool",
						"name": "excluida",
						"type": "bool"
					},
					{
						"internalType": "uint256",
						"name": "respondeA",
						"type": "uint256"
					}
				],
				"internalType": "struct MonchatEnglish.Mensagem[]",
				"name": "",
				"type": "tuple[]"
			},
			{
				"internalType": "uint256",
				"name": "proximaPagina",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_endereco",
				"type": "address"
			}
		],
		"name": "obterPerfilUsuario",
		"outputs": [
			{
				"internalType": "string",
				"name": "username",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "profilePicHash",
				"type": "string"
			},
			{
				"internalType": "bool",
				"name": "exists",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_endereco",
				"type": "address"
			}
		],
		"name": "obterRoleUsuario",
		"outputs": [
			{
				"internalType": "uint8",
				"name": "",
				"type": "uint8"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "obterUsuariosRegistrados",
		"outputs": [
			{
				"internalType": "address[]",
				"name": "enderecos",
				"type": "address[]"
			},
			{
				"internalType": "string[]",
				"name": "usernames",
				"type": "string[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"name": "usernameToAddress",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "userProfiles",
		"outputs": [
			{
				"internalType": "string",
				"name": "username",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "profilePicHash",
				"type": "string"
			},
			{
				"internalType": "bool",
				"name": "exists",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "usuariosBanidos",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "usuariosRegistrados",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

export const MONAD_TESTNET = { 
    chainId: "0x279f", 
    chainName: "Monad Testnet", 
    rpcUrls: [
        "https://rpc.ankr.com/monad_testnet",
        "https://testnet-rpc.monad.xyz",
        "https://monad-testnet.drpc.org"
    ], 
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, 
    blockExplorerUrls: ["https://testnet.monadexplorer.com"] 
};

export const EMOJIS = ['😭', '👀' ,'😂', '❤️', '🔥', '🤣', '✨', '🙏', '😍', '🥺', '😘', '😊', '😃', '😄', '😁', '👍', '😅', '😉', '🤔', '😎', '😏', '😢', '🤗', '🤩', '🤐', '😜', '😇', '🤫', '🤭', '🤓', '😌'];

export const userProfilesCache = new Map();
