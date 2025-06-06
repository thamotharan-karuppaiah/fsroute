// Test script for debugging session replay functionality
// Run this in the browser console on the options page

console.log('🔍 Starting Session Replay Debug Test...');

// Test 1: Check if modal elements exist
function testModalElements() {
  console.log('\n=== Testing Modal Elements ===');
  
  const modal = document.getElementById('sessionReplayModal');
  const closeBtn = document.getElementById('closeSessionReplayBtn');
  const playBtn = document.getElementById('playPauseSessionBtn');
  const speedSelect = document.getElementById('sessionPlaybackSpeed');
  const timeline = document.getElementById('sessionTimeline');
  const timeDisplay = document.getElementById('sessionReplayTime');
  const screenshot = document.getElementById('replayScreenshotImg');
  
  console.log('Modal:', modal ? '✅ Found' : '❌ Missing');
  console.log('Close button:', closeBtn ? '✅ Found' : '❌ Missing');
  console.log('Play button:', playBtn ? '✅ Found' : '❌ Missing');
  console.log('Speed select:', speedSelect ? '✅ Found' : '❌ Missing');
  console.log('Timeline:', timeline ? '✅ Found' : '❌ Missing');
  console.log('Time display:', timeDisplay ? '✅ Found' : '❌ Missing');
  console.log('Screenshot img:', screenshot ? '✅ Found' : '❌ Missing');
  
  return { modal, closeBtn, playBtn, speedSelect, timeline, timeDisplay, screenshot };
}

// Test 2: Check if sessions exist
async function testSessionsData() {
  console.log('\n=== Testing Sessions Data ===');
  
  try {
    const { freshroute_sessions: sessions = [] } = await chrome.storage.local.get(['freshroute_sessions']);
    console.log('Sessions found:', sessions.length);
    
    if (sessions.length > 0) {
      const session = sessions[0];
      console.log('First session:', {
        id: session.id,
        events: session.events?.length || 0,
        screenshots: session.screenshots?.length || 0,
        duration: session.endTime - session.startTime
      });
      return session;
    } else {
      console.log('❌ No sessions found in storage');
      return null;
    }
  } catch (error) {
    console.error('❌ Error loading sessions:', error);
    return null;
  }
}

// Test 3: Test manual modal opening
function testManualModalOpen(session) {
  console.log('\n=== Testing Manual Modal Open ===');
  
  const elements = testModalElements();
  if (!elements.modal) {
    console.error('❌ Cannot test modal - modal element missing');
    return;
  }
  
  console.log('📺 Opening modal manually...');
  elements.modal.style.display = 'block';
  
  if (session && session.screenshots && session.screenshots.length > 0) {
    console.log('🖼️ Loading first screenshot...');
    elements.screenshot.src = session.screenshots[0].dataUrl;
  }
  
  // Test event listeners
  if (elements.closeBtn) {
    elements.closeBtn.onclick = () => {
      console.log('❌ Close button clicked!');
      elements.modal.style.display = 'none';
    };
  }
  
  if (elements.playBtn) {
    elements.playBtn.onclick = () => {
      console.log('▶️ Play button clicked!');
      alert('Play button is working!');
    };
  }
  
  console.log('✅ Modal should now be visible. Try clicking the buttons.');
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Running all debug tests...');
  
  const elements = testModalElements();
  const session = await testSessionsData();
  
  if (session) {
    testManualModalOpen(session);
  } else {
    console.log('⚠️ Cannot test modal with session data - no sessions available');
    console.log('💡 Record a session first, then run this test again');
  }
  
  console.log('\n🏁 Debug test completed. Check above for any issues.');
}

// Auto-run the tests
runAllTests(); 