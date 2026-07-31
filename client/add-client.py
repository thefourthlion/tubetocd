#!/usr/bin/env python3
from pathlib import Path
import os

def writeToFile(path, content):
    file = open(path, "w")
    file.write(content)
    file.close()

# Base paths
current_path = Path.cwd()
app_folder = "app"
components_folder = "components"
styles_folder = "styles"
pages_folder = "pages"

# Full paths
app_directory = os.path.join(current_path, app_folder)
components_directory = os.path.join(current_path, components_folder)
styles_directory = os.path.join(current_path, styles_folder)
pages_directory = os.path.join(app_directory, pages_folder)

def create_page(page_name):
    # Create page directory and file
    page_dir = os.path.join(pages_directory, page_name.lower())
    page_file_path = os.path.join(page_dir, "page.tsx")
    
    # Create style file
    style_file_path = os.path.join(styles_directory, f"{page_name}.scss")
    
    # Page content
    page_content = f'''import React from "react";
import "../../../styles/{page_name}.scss";

const {page_name} = () => {{
    return (
        <div className="{page_name} page">
            <div className="container">
                <h1 className="content-header">{page_name}</h1>
                <div className="content-body">
                    <p>{page_name}</p>
                </div>
            </div>
        </div>
    );
}};

export default {page_name};
'''

    style_content = f'''.{page_name} {{
    display: flex;
    justify-content: center;
    align-items: center;
    .container {{
      
    }}
}}
'''

    # Create directories if they don't exist
    os.makedirs(page_dir, exist_ok=True)
    
    # Create files
    if not os.path.exists(page_file_path):
        writeToFile(page_file_path, page_content)
        print(f"✅ Created page: {page_file_path}")
    else:
        print(f"⭐ Page already exists: {page_file_path}")

    if not os.path.exists(style_file_path):
        writeToFile(style_file_path, style_content)
        print(f"✅ Created style: {style_file_path}")
    else:
        print(f"⭐ Style already exists: {style_file_path}")

def create_component(component_name):
    # Component file path
    component_file_path = os.path.join(components_directory, f"{component_name}.tsx")
    
    # Style file path
    style_file_path = os.path.join(styles_directory, f"{component_name}.scss")
    
    # Component content
    component_content = f'''import React from "react";
import "../styles/{component_name}.scss";

const {component_name} = () => {{
    return (
        <div className="{component_name}">
            <div className="container">
                <h1 className="content-header">{component_name}</h1>
            </div>
        </div>
    );
}};

export default {component_name};
'''

    # Style content
    style_content = f'''.{component_name} {{
    .container {{
        
    }}
}}
'''

    # Create files
    if not os.path.exists(component_file_path):
        writeToFile(component_file_path, component_content)
        print(f"✅ Created component: {component_file_path}")
    else:
        print(f"⭐ Component already exists: {component_file_path}")

    if not os.path.exists(style_file_path):
        writeToFile(style_file_path, style_content)
        print(f"✅ Created style: {style_file_path}")
    else:
        print(f"⭐ Style already exists: {style_file_path}")

def main():
    while True:
        choice = input("Would you like to create a (p)age, (c)omponent, or (q)uit? [p/c/q]: ").lower()
        
        if choice == 'q':
            break
        elif choice == 'p':
            page_name = input("Enter page name (PascalCase): ")
            create_page(page_name)
        elif choice == 'c':
            component_name = input("Enter component name (PascalCase): ")
            create_component(component_name)
        else:
            print("Invalid choice. Please try again.")

if __name__ == "__main__":
    main()