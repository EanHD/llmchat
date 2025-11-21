/**
 * Memory UI Component
 * Handles custom instructions and auto-generated memories
 */

import { storage } from '../core/storage.js';
import { state } from '../core/state.js';
import { $ } from '../utils/dom.js';

export class MemoryUI {
  constructor() {
    this.memoryPanel = $('#memory-panel');
    this.memoryBackdrop = $('#memory-backdrop');
    this.memoryBtn = $('#memory-btn');
    this.closeMemoryBtn = $('#close-memory-btn');
    this.customMemoryInput = $('#custom-memory-input');
    this.saveMemoryBtn = $('#save-memory-btn');
    this.autoMemoriesList = $('#auto-memories-list');
    
    this.init();
  }
  
  async init() {
    if (!this.memoryBtn || !this.memoryPanel) return;
    
    // Toggle memory panel
    this.memoryBtn.addEventListener('click', () => {
      this.show();
    });
    
    this.closeMemoryBtn.addEventListener('click', () => {
      this.hide();
    });

    // Close on backdrop click
    if (this.memoryBackdrop) {
      this.memoryBackdrop.addEventListener('click', () => {
        this.hide();
      });
    }

    // Setup swipe-to-close
    this.setupSwipeToClose();
    
    // Save custom memory
    this.saveMemoryBtn.addEventListener('click', async () => {
      await this.saveCustomMemory();
    });
    
    // Load existing custom memory
    await this.loadCustomMemory();
    
    // Load auto-generated memories
    await this.loadAutoMemories();
  }

  /**
   * Setup swipe-to-close gesture
   */
  setupSwipeToClose() {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    this.memoryPanel.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      isDragging = true;
    }, { passive: true });

    this.memoryPanel.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentX = e.touches[0].clientX;
      const diff = currentX - startX;
      
      // Only allow swipe right
      if (diff > 0) {
        this.memoryPanel.style.transform = `translateX(${diff}px)`;
      }
    }, { passive: true });

    this.memoryPanel.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      
      const diff = currentX - startX;
      
      // Close if swiped more than 100px
      if (diff > 100) {
        this.hide();
      } else {
        // Snap back
        this.memoryPanel.style.transform = '';
      }
    });
  }
  
  show() {
    this.memoryPanel.classList.remove('hidden');
    if (this.memoryBackdrop) {
      this.memoryBackdrop.classList.remove('hidden');
    }
    // Prevent body scroll on mobile
    document.body.style.overflow = 'hidden';
    this.loadCustomMemory();
    this.loadAutoMemories();
  }
  
  hide() {
    this.memoryPanel.classList.add('hidden');
    if (this.memoryBackdrop) {
      this.memoryBackdrop.classList.add('hidden');
    }
    // Reset transform in case it was mid-swipe
    this.memoryPanel.style.transform = '';
    // Restore body scroll
    document.body.style.overflow = '';
  }
  
  async saveCustomMemory() {
    const customMemory = this.customMemoryInput.value.trim();
    
    if (!customMemory) {
      state.showToast('Please enter custom instructions', 'warning');
      return;
    }
    
    try {
      await storage.saveSetting('customMemory', customMemory);
      state.showToast('Custom memory saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save custom memory:', error);
      state.showToast('Failed to save custom memory', 'error');
    }
  }
  
  async loadCustomMemory() {
    try {
      const settings = await storage.getAllSettings();
      if (settings.customMemory) {
        this.customMemoryInput.value = settings.customMemory;
      }
    } catch (error) {
      console.error('Failed to load custom memory:', error);
    }
  }
  
  async loadAutoMemories() {
    try {
      // Get memories from storage
      const memories = await storage.getMemories();
      
      this.renderAutoMemories(memories);
    } catch (error) {
      console.error('Failed to load auto memories:', error);
      this.autoMemoriesList.innerHTML = '<p class="memory-description">No auto-generated memories yet.</p>';
    }
  }
  
  renderAutoMemories(memories) {
    if (!memories || memories.length === 0) {
      this.autoMemoriesList.innerHTML = '<p class="memory-description">The AI will automatically build memories from your conversations. These will appear here.</p>';
      return;
    }
    
    this.autoMemoriesList.innerHTML = '';
    
    memories.forEach(memory => {
      const memoryEl = document.createElement('div');
      memoryEl.className = 'memory-item';
      
      const header = document.createElement('div');
      header.className = 'memory-item-header';
      
      const tags = document.createElement('div');
      tags.className = 'memory-item-tags';
      
      if (memory.tags && memory.tags.length > 0) {
        memory.tags.forEach(tag => {
          const tagEl = document.createElement('span');
          tagEl.className = 'memory-tag';
          tagEl.textContent = tag;
          tags.appendChild(tagEl);
        });
      }
      
      const date = document.createElement('span');
      date.className = 'memory-item-date';
      date.textContent = new Date(memory.created_at).toLocaleDateString();
      
      header.appendChild(tags);
      header.appendChild(date);
      
      const summary = document.createElement('div');
      summary.className = 'memory-item-summary';
      summary.textContent = memory.summary || memory.content || 'No summary available';
      
      memoryEl.appendChild(header);
      memoryEl.appendChild(summary);
      
      this.autoMemoriesList.appendChild(memoryEl);
    });
  }
}
