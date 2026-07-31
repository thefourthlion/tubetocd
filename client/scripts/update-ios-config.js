#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const infoPlistPath = path.join(__dirname, '../ios/App/App/Info.plist');

function updateInfoPlist() {
  try {
    // Read the current Info.plist
    let plistContent = fs.readFileSync(infoPlistPath, 'utf8');
    
    // Check if NSAppTransportSecurity already exists
    if (plistContent.includes('NSAppTransportSecurity')) {
      console.log('✅ NSAppTransportSecurity already configured in Info.plist');
      return;
    }
    
    // Add NSAppTransportSecurity configuration before the closing </dict> and </plist>
    const securityConfig = `	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsArbitraryLoads</key>
		<true/>
		<key>NSExceptionDomains</key>
		<dict>
			<key>localhost</key>
			<dict>
				<key>NSExceptionAllowsInsecureHTTPLoads</key>
				<true/>
			</dict>
		</dict>
	</dict>
</dict>
</plist>`;
    
    // Replace the closing tags with our configuration
    plistContent = plistContent.replace(/<\/dict>\s*<\/plist>\s*$/, securityConfig);
    
    // Write the updated content back
    fs.writeFileSync(infoPlistPath, plistContent, 'utf8');
    
    console.log('✅ Successfully updated Info.plist with NSAppTransportSecurity settings');
  } catch (error) {
    console.error('❌ Error updating Info.plist:', error.message);
    process.exit(1);
  }
}

updateInfoPlist();
