// Simple Session Replay Debug Script
// Copy and paste this into the browser console on the options page

console.log('🔧 Session Replay Debug Tool');

// 1. Test if modal elements exist
function testElements() {
  const elements = {
    modal: document.getElementById('sessionReplayModal'),
    closeBtn: document.getElementById('closeSessionReplayBtn'),
    playBtn: document.getElementById('playPauseSessionBtn'),
    img: document.getElementById('replayScreenshotImg'),
    cursor: document.getElementById('virtualCursorDiv'),
    timeline: document.getElementById('sessionTimeline'),
    timeDisplay: document.getElementById('sessionReplayTime'),
    speedSelect: document.getElementById('sessionPlaybackSpeed')
  };
  
  console.log('Element Check:');
  Object.keys(elements).forEach(key => {
    const exists = elements[key] !== null;
    console.log(`  ${key}: ${exists ? '✅' : '❌'}`);
    if (!exists) console.warn(`  Missing element: #${key}`);
  });
  
  return elements;
}

// 2. Test modal opening
function testModalOpen() {
  const modal = document.getElementById('sessionReplayModal');
  if (modal) {
    console.log('📺 Opening modal...');
    modal.style.display = 'block';
    modal.style.zIndex = '9999';
    console.log('Modal display style:', modal.style.display);
  } else {
    console.error('❌ Modal not found');
  }
}

// 3. Test play button click
function testPlayButton() {
  const playBtn = document.getElementById('playPauseSessionBtn');
  if (playBtn) {
    console.log('🎮 Testing play button...');
    
    // Add test click handler
    playBtn.onclick = () => {
      console.log('✅ Play button clicked successfully!');
      alert('Play button is working!');
    };
    
    // Test direct click
    playBtn.click();
  } else {
    console.error('❌ Play button not found');
  }
}

// 4. Test close button
function testCloseButton() {
  const closeBtn = document.getElementById('closeSessionReplayBtn');
  if (closeBtn) {
    console.log('❌ Testing close button...');
    
    // Add test click handler
    closeBtn.onclick = () => {
      console.log('✅ Close button clicked!');
      const modal = document.getElementById('sessionReplayModal');
      if (modal) {
        modal.style.display = 'none';
        console.log('Modal closed');
      }
    };
  } else {
    console.error('❌ Close button not found');
  }
}

// 5. Check for any existing event listeners
function checkEventListeners() {
  const playBtn = document.getElementById('playPauseSessionBtn');
  if (playBtn) {
    console.log('🔍 Checking existing event listeners...');
    console.log('Play button onclick:', playBtn.onclick);
    console.log('Play button events:', getEventListeners ? getEventListeners(playBtn) : 'getEventListeners not available');
  }
}

// 6. Run all tests
function runAllTests() {
  console.clear();
  console.log('🚀 Starting Session Replay Debug Tests');
  
  testElements();
  console.log('---');
  
  testModalOpen();
  console.log('---');
  
  testCloseButton();
  console.log('---');
  
  testPlayButton();
  console.log('---');
  
  checkEventListeners();
  console.log('---');
  
  console.log('✅ Debug tests complete. Try clicking the buttons in the modal.');
}

// Auto-run
runAllTests(); 