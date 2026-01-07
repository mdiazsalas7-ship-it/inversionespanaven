
import React, { useState } from 'react';
import { ChatMessage } from '../types';

interface ChatWindowProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  role: 'client' | 'admin';
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSendMessage, role }) => {
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="flex flex-col h-64 border rounded-lg bg-white overflow-hidden shadow-sm">
      <div className="bg-blue-600 text-white p-2 text-sm font-semibold flex justify-between items-center">
        <span>Chat con {role === 'admin' ? 'Cliente' : 'Administrador'}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.sender === role ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              msg.sender === role 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none shadow-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-center text-slate-400 text-xs mt-4 italic">No hay mensajes aún. Escribe algo para iniciar.</p>
        )}
      </div>
      <div className="p-2 border-t flex gap-2">
        <input 
          type="text" 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Escribe un mensaje..."
          className="flex-1 border rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button 
          onClick={handleSend}
          className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-blue-700 transition"
        >
          Enviar
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;
