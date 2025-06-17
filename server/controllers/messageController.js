

//get all users except logged in user

import Message from "../models/message.js";
import User from "../models/User.js";
import cloudinary from "../lib/cloudinary.js";
import { io,userSocketMap } from "../server.js";
export const getUsersForSidebar = async (req,res)=>{
    try {
        const userId = req.user._id;
        const filteredUsers = await User.find({_id:{$ne:userId}}).select("-password");

        //count number of messages not seen 
        const unseenMessages= {}
        const promises = filteredUsers.map(async (user)=>{
            const messages = await Message.find({senderId:user._id,receiverId:userId , seen:false})
            if(messages.length > 0){
                unseenMessages[user._id]=messages.length;

            }
        })
        await Promise.all(promises);
        res.json({success:true,users:filteredUsers,unseenMessages})
    } catch (error) {
         res.json({success:false,message:error.message})
         console.log(error.message);
    }
}

//get all messages for selected users
export const getMessages = async (req,res)=>{
    try {
        const {id:selectedUserId} = req.params;
        const myId = req.user._id;
        const messages = await Message.find({
            $or:[
                {senderId:myId , receiverId: selectedUserId},
                {senderId:selectedUserId , receiverId: myId},
            ]
        })
        await Message.updateMany({senderId:selectedUserId,receiverId:myId},{seen:true});
        res.json({success:true,messages})
    } catch (error) {
         res.json({success:false,message:error.message})
         console.log(error.message);
    }
}

//api to mark message as seen using message id
export const markMessageAsSeen = async (req,res)=>{
    try {
        const {id} = req.params;
        await Message.findByIdAndUpdate(id,{seen:true})
        res.json({success:true})
    } catch (error) {
         res.json({success:false,message:error.message})
         console.log(error.message);
    }
}

//send message to selected user

export const sendMessage = async(req,res)=>{
    try {
        const {text,image}= req.body;
        const receiverId = req.params.id;
        const senderId = req.user._id;

        let imageUrl;
        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image)
            imageUrl = uploadResponse.secure_url;
        }

        const newMessage = await Message.create({
            senderId,
            receiverId:receiverId,
            text,
            image:imageUrl
        })

        //emit new message to the reciever's socket
        const recieverSocketId = userSocketMap[receiverId];

        if (recieverSocketId) {
            io.to(recieverSocketId).emit("newMessage",newMessage)
        }

        res.json({success:true,newMessage});

    } catch (error) {
         res.json({success:false,message:error.message})
         console.log(error.message);
    }
}
